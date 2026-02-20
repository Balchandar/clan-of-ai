from __future__ import annotations

import dataclasses
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.intentusnet_client import (
    IntentusNetClient,
    IntentusNetError,
    IntentusNetUnavailableError,
    IntentusNetValidationError,
)
from app.domain.models import (
    AuditAction,
    ErrorClass,
    ExecutionDAG,
    ExecutionDiff,
    ExecutionStatus,
    ReplayStep,
)
from app.domain.orm_models import ClanExecutionORM
from app.repositories.audit_repository import AuditRepository
from app.repositories.clan_repository import ClanRepository
from app.repositories.execution_repository import ExecutionRepository
from app.repositories.governance_repository import GovernanceRepository
from app.logging_config import get_logger

logger = get_logger(__name__)


def _dag_to_dict(dag: ExecutionDAG) -> dict[str, Any]:
    return {
        "nodes": [dataclasses.asdict(n) for n in dag.nodes],
        "edges": [list(e) for e in dag.edges],
        "metadata": dag.metadata,
    }


def _classify_error(exc: Exception) -> ErrorClass:
    if isinstance(exc, IntentusNetUnavailableError):
        return ErrorClass.TRANSIENT
    if isinstance(exc, IntentusNetValidationError):
        return ErrorClass.VALIDATION
    return ErrorClass.PERMANENT


class ExecutionService:
    def __init__(self, session: AsyncSession, intentusnet: IntentusNetClient) -> None:
        self._session = session
        self._intentusnet = intentusnet
        self._execution_repo = ExecutionRepository(session)
        self._clan_repo = ClanRepository(session)
        self._governance_repo = GovernanceRepository(session)
        self._audit_repo = AuditRepository(session)

    async def run_clan_task(
        self,
        clan_id: UUID,
        task: str,
        task_inputs: dict[str, Any],
        override_governance: dict[str, Any],
        actor: str = "system",
    ) -> ClanExecutionORM:
        clan = await self._clan_repo.get_by_id(clan_id)
        if not clan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clan not found")

        governance = await self._governance_repo.get_or_create_default(clan_id)

        execution = await self._execution_repo.create(
            clan_id=clan_id,
            task=task,
            task_inputs=task_inputs,
        )

        await self._audit_repo.log(
            action=AuditAction.EXECUTION_STARTED,
            actor=actor,
            clan_id=clan_id,
            execution_id=execution.id,
            payload={"task": task},
        )

        execution = await self._execution_repo.update_running(execution)

        agents_payload = [
            {
                "agent_id": a.agent_id,
                "name": a.name,
                "role": a.role,
                "config": a.config,
            }
            for a in clan.agents
        ]

        gov_payload = {
            "max_retries": governance.max_retries,
            "timeout_s": governance.timeout_s,
            "require_determinism_verification": governance.require_determinism_verification,
            **override_governance,
        }

        try:
            _intentusnet_id, dag = await self._intentusnet.run_execution(
                clan_id=clan_id,
                task=task,
                task_inputs=task_inputs,
                agents=agents_payload,
                governance=gov_payload,
            )

            execution_hash = dag.compute_hash()
            determinism_verified = governance.require_determinism_verification

            dag_dict = _dag_to_dict(dag)
            execution = await self._execution_repo.update_completed(
                execution=execution,
                dag=dag_dict,
                execution_hash=execution_hash,
                determinism_verified=determinism_verified,
            )

            outputs = {}
            if dag.nodes:
                last_node = dag.nodes[-1]
                outputs = last_node.outputs

            await self._execution_repo.create_metadata(
                execution_id=execution.id,
                inputs=task_inputs,
                outputs=outputs,
                duration_ms=dag.total_duration_ms(),
                node_count=dag.node_count(),
                determinism_verified=determinism_verified,
            )

            await self._audit_repo.log(
                action=AuditAction.EXECUTION_COMPLETED,
                actor=actor,
                clan_id=clan_id,
                execution_id=execution.id,
                payload={"execution_hash": execution_hash, "node_count": dag.node_count()},
            )

            logger.info(
                "execution.completed",
                execution_id=str(execution.id),
                hash=execution_hash,
                nodes=dag.node_count(),
            )

        except (IntentusNetError, Exception) as exc:
            error_class = _classify_error(exc)
            error_message = str(exc)
            execution = await self._execution_repo.update_failed(
                execution=execution,
                error_message=error_message,
                error_class=error_class.value,
                retry_count=execution.retry_count,
            )
            await self._audit_repo.log(
                action=AuditAction.EXECUTION_FAILED,
                actor=actor,
                clan_id=clan_id,
                execution_id=execution.id,
                payload={"error": error_message, "error_class": error_class.value},
            )
            logger.error("execution.failed", execution_id=str(execution.id), error=error_message)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Execution failed: {error_message}",
            ) from exc

        return await self._execution_repo.get_by_id(execution.id)

    async def get_execution(self, execution_id: UUID) -> ClanExecutionORM:
        execution = await self._execution_repo.get_by_id(execution_id)
        if not execution:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
        return execution

    async def list_clan_executions(
        self,
        clan_id: UUID,
        offset: int = 0,
        limit: int = 50,
    ) -> list[ClanExecutionORM]:
        clan = await self._clan_repo.get_by_id(clan_id)
        if not clan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clan not found")
        return await self._execution_repo.list_by_clan(clan_id, offset=offset, limit=limit)

    async def replay_execution(
        self,
        execution_id: UUID,
        step_limit: int | None = None,
        actor: str = "system",
    ) -> list[ReplayStep]:
        execution = await self.get_execution(execution_id)

        if execution.status != ExecutionStatus.COMPLETED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot replay execution with status '{execution.status}'",
            )

        await self._audit_repo.log(
            action=AuditAction.REPLAY_STARTED,
            actor=actor,
            clan_id=execution.clan_id,
            execution_id=execution_id,
            payload={"step_limit": step_limit},
        )

        intentusnet_exec_id = execution.execution_hash or str(execution_id)

        try:
            steps = await self._intentusnet.replay_execution(
                intentusnet_execution_id=intentusnet_exec_id,
                step_limit=step_limit,
            )
        except IntentusNetError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Replay failed: {exc}",
            ) from exc

        return steps

    async def diff_executions(
        self,
        execution_a_id: UUID,
        execution_b_id: UUID,
    ) -> ExecutionDiff:
        exec_a = await self.get_execution(execution_a_id)
        exec_b = await self.get_execution(execution_b_id)

        for ex in (exec_a, exec_b):
            if ex.status != ExecutionStatus.COMPLETED.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Execution {ex.id} must be completed to diff",
                )

        hash_a = exec_a.execution_hash or str(execution_a_id)
        hash_b = exec_b.execution_hash or str(execution_b_id)

        try:
            diff = await self._intentusnet.diff_executions(
                intentusnet_execution_a_id=hash_a,
                intentusnet_execution_b_id=hash_b,
                clan_execution_a_id=execution_a_id,
                clan_execution_b_id=execution_b_id,
            )
        except IntentusNetError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Diff failed: {exc}",
            ) from exc

        return diff

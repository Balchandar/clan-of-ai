from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.models import ExecutionStatus
from app.domain.orm_models import ClanExecutionORM, ExecutionMetadataORM
from app.logging_config import get_logger

logger = get_logger(__name__)


class ExecutionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        clan_id: UUID,
        task: str,
        task_inputs: dict[str, Any],
    ) -> ClanExecutionORM:
        execution = ClanExecutionORM(
            id=uuid.uuid4(),
            clan_id=clan_id,
            task=task,
            task_inputs=task_inputs,
            status=ExecutionStatus.PENDING.value,
        )
        self._session.add(execution)
        await self._session.flush()
        await self._session.refresh(execution)
        return execution

    async def get_by_id(self, execution_id: UUID) -> ClanExecutionORM | None:
        result = await self._session.execute(
            select(ClanExecutionORM)
            .options(selectinload(ClanExecutionORM.metadata_record))
            .where(ClanExecutionORM.id == execution_id)
        )
        return result.scalar_one_or_none()

    async def list_by_clan(
        self,
        clan_id: UUID,
        offset: int = 0,
        limit: int = 50,
    ) -> list[ClanExecutionORM]:
        result = await self._session.execute(
            select(ClanExecutionORM)
            .where(ClanExecutionORM.clan_id == clan_id)
            .order_by(ClanExecutionORM.started_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def update_running(self, execution: ClanExecutionORM) -> ClanExecutionORM:
        execution.status = ExecutionStatus.RUNNING.value
        await self._session.flush()
        return execution

    async def update_completed(
        self,
        execution: ClanExecutionORM,
        dag: dict[str, Any],
        execution_hash: str,
        determinism_verified: bool,
    ) -> ClanExecutionORM:
        execution.status = ExecutionStatus.COMPLETED.value
        execution.dag = dag
        execution.execution_hash = execution_hash
        execution.determinism_verified = determinism_verified
        execution.completed_at = datetime.now(timezone.utc)
        await self._session.flush()
        return execution

    async def update_failed(
        self,
        execution: ClanExecutionORM,
        error_message: str,
        error_class: str,
        retry_count: int,
    ) -> ClanExecutionORM:
        execution.status = ExecutionStatus.FAILED.value
        execution.error_message = error_message
        execution.error_class = error_class
        execution.retry_count = retry_count
        execution.completed_at = datetime.now(timezone.utc)
        await self._session.flush()
        return execution

    async def create_metadata(
        self,
        execution_id: UUID,
        inputs: dict[str, Any],
        outputs: dict[str, Any],
        duration_ms: int,
        node_count: int,
        determinism_verified: bool,
    ) -> ExecutionMetadataORM:
        meta = ExecutionMetadataORM(
            id=uuid.uuid4(),
            execution_id=execution_id,
            inputs=inputs,
            outputs=outputs,
            duration_ms=duration_ms,
            node_count=node_count,
            determinism_verified=determinism_verified,
        )
        self._session.add(meta)
        await self._session.flush()
        return meta

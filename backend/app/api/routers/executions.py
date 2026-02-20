from __future__ import annotations

import dataclasses
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import get_execution_service
from app.domain.orm_models import ClanExecutionORM
from app.schemas.execution import (
    DAGNodeResponse,
    DiffRequest,
    DiffResponse,
    ExecutionDAGResponse,
    ExecutionListResponse,
    ExecutionMetadataResponse,
    ExecutionResponse,
    NodeDiffResponse,
    ReplayRequest,
    ReplayResponse,
    ReplayStepResponse,
    RunTaskRequest,
)
from app.services.execution_service import ExecutionService

router = APIRouter(tags=["Executions"])


def _dag_response(dag_dict: dict[str, Any] | None) -> ExecutionDAGResponse | None:
    if not dag_dict:
        return None
    nodes = [
        DAGNodeResponse(
            node_id=n["node_id"],
            agent_id=n["agent_id"],
            task_name=n["task_name"],
            status=n["status"],
            inputs=n.get("inputs", {}),
            outputs=n.get("outputs", {}),
            duration_ms=n.get("duration_ms", 0),
            dependencies=n.get("dependencies", []),
            error=n.get("error"),
        )
        for n in dag_dict.get("nodes", [])
    ]
    return ExecutionDAGResponse(
        nodes=nodes,
        edges=dag_dict.get("edges", []),
        metadata=dag_dict.get("metadata", {}),
    )


def _to_execution_response(ex: ClanExecutionORM) -> ExecutionResponse:
    meta = None
    if ex.metadata_record:
        meta = ExecutionMetadataResponse(
            id=ex.metadata_record.id,
            execution_id=ex.metadata_record.execution_id,
            inputs=ex.metadata_record.inputs,
            outputs=ex.metadata_record.outputs,
            duration_ms=ex.metadata_record.duration_ms,
            node_count=ex.metadata_record.node_count,
            determinism_verified=ex.metadata_record.determinism_verified,
        )
    return ExecutionResponse(
        id=ex.id,
        clan_id=ex.clan_id,
        task=ex.task,
        task_inputs=ex.task_inputs,
        status=ex.status,
        execution_hash=ex.execution_hash,
        dag=_dag_response(ex.dag),
        started_at=ex.started_at,
        completed_at=ex.completed_at,
        error_message=ex.error_message,
        error_class=ex.error_class,
        retry_count=ex.retry_count,
        determinism_verified=ex.determinism_verified,
        metadata_record=meta,
    )


@router.post("/clans/{clan_id}/run", response_model=ExecutionResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_clan_task(
    clan_id: UUID,
    body: RunTaskRequest,
    service: ExecutionService = Depends(get_execution_service),
) -> ExecutionResponse:
    execution = await service.run_clan_task(
        clan_id=clan_id,
        task=body.task,
        task_inputs=body.inputs,
        override_governance=body.override_governance,
    )
    return _to_execution_response(execution)


@router.get("/clans/{clan_id}/executions", response_model=list[ExecutionListResponse])
async def list_clan_executions(
    clan_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    service: ExecutionService = Depends(get_execution_service),
) -> list[ExecutionListResponse]:
    executions = await service.list_clan_executions(clan_id, offset=offset, limit=limit)
    return [
        ExecutionListResponse(
            id=ex.id,
            clan_id=ex.clan_id,
            task=ex.task,
            status=ex.status,
            execution_hash=ex.execution_hash,
            started_at=ex.started_at,
            completed_at=ex.completed_at,
            retry_count=ex.retry_count,
        )
        for ex in executions
    ]


@router.get("/executions/{execution_id}", response_model=ExecutionResponse)
async def get_execution(
    execution_id: UUID,
    service: ExecutionService = Depends(get_execution_service),
) -> ExecutionResponse:
    execution = await service.get_execution(execution_id)
    return _to_execution_response(execution)


@router.post("/executions/{execution_id}/replay", response_model=ReplayResponse)
async def replay_execution(
    execution_id: UUID,
    body: ReplayRequest,
    service: ExecutionService = Depends(get_execution_service),
) -> ReplayResponse:
    steps = await service.replay_execution(
        execution_id=execution_id,
        step_limit=body.step_limit,
    )
    return ReplayResponse(
        execution_id=execution_id,
        total_steps=len(steps),
        steps=[
            ReplayStepResponse(
                step_index=s.step_index,
                node_id=s.node_id,
                agent_id=s.agent_id,
                task_name=s.task_name,
                status=s.status,
                inputs=s.inputs,
                outputs=s.outputs,
                duration_ms=s.duration_ms,
                cumulative_duration_ms=s.cumulative_duration_ms,
            )
            for s in steps
        ],
    )


@router.post("/executions/diff", response_model=DiffResponse)
async def diff_executions(
    body: DiffRequest,
    service: ExecutionService = Depends(get_execution_service),
) -> DiffResponse:
    diff = await service.diff_executions(
        execution_a_id=body.execution_a_id,
        execution_b_id=body.execution_b_id,
    )
    return DiffResponse(
        execution_a_id=diff.execution_a_id,
        execution_b_id=diff.execution_b_id,
        diverged=diff.diverged,
        divergence_node=diff.divergence_node,
        node_diffs=[
            NodeDiffResponse(
                node_id=d.node_id,
                field=d.field,
                value_a=d.value_a,
                value_b=d.value_b,
                is_diverged=d.is_diverged,
            )
            for d in diff.node_diffs
        ],
        summary=diff.summary,
    )

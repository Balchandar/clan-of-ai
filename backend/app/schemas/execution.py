from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class RunTaskRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=512, description="Natural language task description")
    inputs: dict[str, Any] = Field(default_factory=dict, description="Task input parameters")
    override_governance: dict[str, Any] = Field(default_factory=dict, description="Per-run governance overrides")


class ReplayRequest(BaseModel):
    step_limit: int | None = Field(default=None, ge=1, description="Limit replay to first N steps")


class DiffRequest(BaseModel):
    execution_a_id: UUID = Field(..., description="First execution ID")
    execution_b_id: UUID = Field(..., description="Second execution ID")


class DAGNodeResponse(BaseModel):
    node_id: str
    agent_id: str
    task_name: str
    status: str
    inputs: dict[str, Any]
    outputs: dict[str, Any]
    duration_ms: int
    dependencies: list[str]
    error: str | None = None


class ExecutionDAGResponse(BaseModel):
    nodes: list[DAGNodeResponse]
    edges: list[list[str]]
    metadata: dict[str, Any]


class ExecutionMetadataResponse(BaseModel):
    id: UUID
    execution_id: UUID
    inputs: dict[str, Any]
    outputs: dict[str, Any]
    duration_ms: int
    node_count: int
    determinism_verified: bool

    model_config = {"from_attributes": True}


class ExecutionResponse(BaseModel):
    id: UUID
    clan_id: UUID
    task: str
    task_inputs: dict[str, Any]
    status: str
    execution_hash: str | None
    dag: ExecutionDAGResponse | None
    started_at: datetime
    completed_at: datetime | None
    error_message: str | None
    error_class: str | None
    retry_count: int
    determinism_verified: bool
    metadata_record: ExecutionMetadataResponse | None = None

    model_config = {"from_attributes": True}


class ExecutionListResponse(BaseModel):
    id: UUID
    clan_id: UUID
    task: str
    status: str
    execution_hash: str | None
    started_at: datetime
    completed_at: datetime | None
    retry_count: int

    model_config = {"from_attributes": True}


class ReplayStepResponse(BaseModel):
    step_index: int
    node_id: str
    agent_id: str
    task_name: str
    status: str
    inputs: dict[str, Any]
    outputs: dict[str, Any]
    duration_ms: int
    cumulative_duration_ms: int


class ReplayResponse(BaseModel):
    execution_id: UUID
    total_steps: int
    steps: list[ReplayStepResponse]


class NodeDiffResponse(BaseModel):
    node_id: str
    field: str
    value_a: Any
    value_b: Any
    is_diverged: bool


class DiffResponse(BaseModel):
    execution_a_id: UUID
    execution_b_id: UUID
    diverged: bool
    divergence_node: str | None
    node_diffs: list[NodeDiffResponse]
    summary: str

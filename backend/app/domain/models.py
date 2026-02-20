"""
Pure domain models — no SQLAlchemy, no HTTP, no I/O.
These represent the core business concepts of Clan-of-AI.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID


class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    REPLAYING = "replaying"
    CANCELLED = "cancelled"


class AgentRole(str, Enum):
    ORCHESTRATOR = "orchestrator"
    WORKER = "worker"
    VALIDATOR = "validator"
    MONITOR = "monitor"


class AuditAction(str, Enum):
    CLAN_CREATED = "clan_created"
    CLAN_DELETED = "clan_deleted"
    CLAN_CLONED = "clan_cloned"
    AGENT_ADDED = "agent_added"
    AGENT_REMOVED = "agent_removed"
    EXECUTION_STARTED = "execution_started"
    EXECUTION_COMPLETED = "execution_completed"
    EXECUTION_FAILED = "execution_failed"
    REPLAY_STARTED = "replay_started"
    GOVERNANCE_UPDATED = "governance_updated"


class ErrorClass(str, Enum):
    TRANSIENT = "transient"
    PERMANENT = "permanent"
    TIMEOUT = "timeout"
    VALIDATION = "validation"
    UPSTREAM = "upstream"


@dataclass(frozen=True)
class DomainAgent:
    agent_id: str
    name: str
    role: AgentRole
    config: dict[str, Any]


@dataclass(frozen=True)
class DomainClan:
    id: UUID
    name: str
    description: str
    agents: list[DomainAgent]
    config: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    def agent_ids(self) -> list[str]:
        return [a.agent_id for a in self.agents]

    def has_orchestrator(self) -> bool:
        return any(a.role == AgentRole.ORCHESTRATOR for a in self.agents)


@dataclass(frozen=True)
class DAGNode:
    node_id: str
    agent_id: str
    task_name: str
    status: str
    inputs: dict[str, Any]
    outputs: dict[str, Any]
    duration_ms: int
    dependencies: list[str]
    error: str | None = None


@dataclass(frozen=True)
class ExecutionDAG:
    nodes: list[DAGNode]
    edges: list[tuple[str, str]]
    metadata: dict[str, Any]

    def compute_hash(self) -> str:
        payload = json.dumps(
            {
                "nodes": [n.node_id for n in sorted(self.nodes, key=lambda x: x.node_id)],
                "edges": sorted(self.edges),
            },
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode()).hexdigest()

    def node_count(self) -> int:
        return len(self.nodes)

    def total_duration_ms(self) -> int:
        return sum(n.duration_ms for n in self.nodes)


@dataclass(frozen=True)
class DomainExecution:
    id: UUID
    clan_id: UUID
    task: str
    task_inputs: dict[str, Any]
    status: ExecutionStatus
    execution_hash: str | None
    dag: ExecutionDAG | None
    started_at: datetime
    completed_at: datetime | None
    error_message: str | None
    error_class: ErrorClass | None
    retry_count: int
    determinism_verified: bool

    def is_terminal(self) -> bool:
        return self.status in (
            ExecutionStatus.COMPLETED,
            ExecutionStatus.FAILED,
            ExecutionStatus.CANCELLED,
        )


@dataclass(frozen=True)
class GovernanceRule:
    rule_id: str
    name: str
    condition: str
    action: str
    enabled: bool
    priority: int


@dataclass(frozen=True)
class DomainGovernance:
    id: UUID
    clan_id: UUID
    max_retries: int
    timeout_s: int
    max_concurrent_executions: int
    allowed_agent_roles: list[AgentRole]
    rules: list[GovernanceRule]
    require_determinism_verification: bool
    updated_at: datetime


@dataclass(frozen=True)
class DomainAuditLog:
    id: UUID
    clan_id: UUID | None
    execution_id: UUID | None
    action: AuditAction
    actor: str
    payload: dict[str, Any]
    created_at: datetime


@dataclass(frozen=True)
class ExecutionDiff:
    execution_a_id: UUID
    execution_b_id: UUID
    diverged: bool
    divergence_node: str | None
    node_diffs: list[NodeDiff]
    summary: str


@dataclass(frozen=True)
class NodeDiff:
    node_id: str
    field: str
    value_a: Any
    value_b: Any
    is_diverged: bool


@dataclass(frozen=True)
class ReplayStep:
    step_index: int
    node_id: str
    agent_id: str
    task_name: str
    status: str
    inputs: dict[str, Any]
    outputs: dict[str, Any]
    duration_ms: int
    cumulative_duration_ms: int

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class GovernanceRuleRequest(BaseModel):
    rule_id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=255)
    condition: str = Field(..., description="Condition expression (e.g. 'retry_count > 2')")
    action: str = Field(..., description="Action to take (e.g. 'halt', 'alert', 'retry')")
    enabled: bool = True
    priority: int = Field(default=0, ge=0, le=1000)


class GovernanceUpdateRequest(BaseModel):
    max_retries: int = Field(default=3, ge=0, le=10)
    timeout_s: int = Field(default=300, ge=1, le=3600)
    max_concurrent_executions: int = Field(default=5, ge=1, le=50)
    allowed_agent_roles: list[str] = Field(default_factory=lambda: ["orchestrator", "worker", "validator", "monitor"])
    rules: list[GovernanceRuleRequest] = Field(default_factory=list)
    require_determinism_verification: bool = False


class GovernanceRuleResponse(BaseModel):
    rule_id: str
    name: str
    condition: str
    action: str
    enabled: bool
    priority: int


class GovernanceResponse(BaseModel):
    id: UUID
    clan_id: UUID
    max_retries: int
    timeout_s: int
    max_concurrent_executions: int
    allowed_agent_roles: list[str]
    rules: list[GovernanceRuleResponse]
    require_determinism_verification: bool
    updated_at: datetime

    model_config = {"from_attributes": True}

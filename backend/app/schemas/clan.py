from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class AgentCreateRequest(BaseModel):
    agent_id: str = Field(..., min_length=1, max_length=255, description="Unique agent identifier within this clan")
    name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(..., description="One of: orchestrator, worker, validator, monitor")
    config: dict[str, Any] = Field(default_factory=dict)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        valid = {"orchestrator", "worker", "validator", "monitor"}
        if v not in valid:
            raise ValueError(f"role must be one of {valid}")
        return v


class AgentResponse(BaseModel):
    id: UUID
    clan_id: UUID
    agent_id: str
    name: str
    role: str
    config: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class ClanCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=2048)
    config: dict[str, Any] = Field(default_factory=dict)


class ClanCloneRequest(BaseModel):
    new_name: str = Field(..., min_length=1, max_length=255)
    override_config: dict[str, Any] = Field(default_factory=dict, description="Merged on top of source clan config")


class ClanResponse(BaseModel):
    id: UUID
    name: str
    description: str
    config: dict[str, Any]
    agents: list[AgentResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClanListResponse(BaseModel):
    id: UUID
    name: str
    description: str
    agent_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

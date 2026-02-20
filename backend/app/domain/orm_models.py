"""
SQLAlchemy ORM models — mapped to Postgres tables.
These are persistence concerns only. Domain logic lives in domain/models.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ClanORM(Base):
    __tablename__ = "clans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    agents: Mapped[list[ClanAgentORM]] = relationship("ClanAgentORM", back_populates="clan", cascade="all, delete-orphan")
    executions: Mapped[list[ClanExecutionORM]] = relationship("ClanExecutionORM", back_populates="clan", cascade="all, delete-orphan")
    governance: Mapped[GovernanceConfigORM | None] = relationship("GovernanceConfigORM", back_populates="clan", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (Index("ix_clans_name", "name"),)


class ClanAgentORM(Base):
    __tablename__ = "clan_agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clans.id", ondelete="CASCADE"), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(64), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    clan: Mapped[ClanORM] = relationship("ClanORM", back_populates="agents")

    __table_args__ = (
        UniqueConstraint("clan_id", "agent_id", name="uq_clan_agents_clan_agent"),
        Index("ix_clan_agents_clan_id", "clan_id"),
    )


class ClanExecutionORM(Base):
    __tablename__ = "clan_executions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clans.id", ondelete="CASCADE"), nullable=False)
    task: Mapped[str] = mapped_column(String(512), nullable=False)
    task_inputs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="pending")
    execution_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    dag: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    determinism_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    clan: Mapped[ClanORM] = relationship("ClanORM", back_populates="executions")
    metadata_record: Mapped[ExecutionMetadataORM | None] = relationship(
        "ExecutionMetadataORM", back_populates="execution", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_clan_executions_clan_id", "clan_id"),
        Index("ix_clan_executions_status", "status"),
        Index("ix_clan_executions_started_at", "started_at"),
    )


class ExecutionMetadataORM(Base):
    __tablename__ = "execution_metadata"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clan_executions.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    inputs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    outputs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    node_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    determinism_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    execution: Mapped[ClanExecutionORM] = relationship("ClanExecutionORM", back_populates="metadata_record")


class GovernanceConfigORM(Base):
    __tablename__ = "governance_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clans.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    timeout_s: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    max_concurrent_executions: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    allowed_agent_roles: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    rules: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    require_determinism_verification: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    clan: Mapped[ClanORM] = relationship("ClanORM", back_populates="governance")


class AuditLogORM(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    execution_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    actor: Mapped[str] = mapped_column(String(255), nullable=False, default="system")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    __table_args__ = (
        Index("ix_audit_logs_clan_id", "clan_id"),
        Index("ix_audit_logs_execution_id", "execution_id"),
        Index("ix_audit_logs_created_at", "created_at"),
    )

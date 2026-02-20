from __future__ import annotations

import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import AuditAction
from app.domain.orm_models import AuditLogORM
from app.logging_config import get_logger

logger = get_logger(__name__)


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def log(
        self,
        action: AuditAction,
        actor: str = "system",
        clan_id: UUID | None = None,
        execution_id: UUID | None = None,
        payload: dict[str, Any] | None = None,
    ) -> AuditLogORM:
        entry = AuditLogORM(
            id=uuid.uuid4(),
            clan_id=clan_id,
            execution_id=execution_id,
            action=action.value,
            actor=actor,
            payload=payload or {},
        )
        self._session.add(entry)
        await self._session.flush()
        logger.info("audit.log", action=action.value, clan_id=str(clan_id) if clan_id else None, actor=actor)
        return entry

    async def list_by_clan(
        self,
        clan_id: UUID,
        offset: int = 0,
        limit: int = 100,
    ) -> list[AuditLogORM]:
        result = await self._session.execute(
            select(AuditLogORM)
            .where(AuditLogORM.clan_id == clan_id)
            .order_by(AuditLogORM.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

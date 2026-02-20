from __future__ import annotations

import uuid
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.orm_models import GovernanceConfigORM
from app.logging_config import get_logger

logger = get_logger(__name__)

_DEFAULT_ROLES = ["orchestrator", "worker", "validator", "monitor"]


class GovernanceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_clan_id(self, clan_id: UUID) -> GovernanceConfigORM | None:
        result = await self._session.execute(
            select(GovernanceConfigORM).where(GovernanceConfigORM.clan_id == clan_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create_default(self, clan_id: UUID) -> GovernanceConfigORM:
        existing = await self.get_by_clan_id(clan_id)
        if existing:
            return existing
        gov = GovernanceConfigORM(
            id=uuid.uuid4(),
            clan_id=clan_id,
            max_retries=3,
            timeout_s=300,
            max_concurrent_executions=5,
            allowed_agent_roles=_DEFAULT_ROLES,
            rules=[],
            require_determinism_verification=False,
        )
        self._session.add(gov)
        await self._session.flush()
        await self._session.refresh(gov)
        return gov

    async def upsert(
        self,
        clan_id: UUID,
        max_retries: int,
        timeout_s: int,
        max_concurrent_executions: int,
        allowed_agent_roles: list[str],
        rules: list[dict],
        require_determinism_verification: bool,
    ) -> GovernanceConfigORM:
        existing = await self.get_by_clan_id(clan_id)
        if existing:
            existing.max_retries = max_retries
            existing.timeout_s = timeout_s
            existing.max_concurrent_executions = max_concurrent_executions
            existing.allowed_agent_roles = allowed_agent_roles
            existing.rules = rules
            existing.require_determinism_verification = require_determinism_verification
            await self._session.flush()
            return existing

        gov = GovernanceConfigORM(
            id=uuid.uuid4(),
            clan_id=clan_id,
            max_retries=max_retries,
            timeout_s=timeout_s,
            max_concurrent_executions=max_concurrent_executions,
            allowed_agent_roles=allowed_agent_roles,
            rules=rules,
            require_determinism_verification=require_determinism_verification,
        )
        self._session.add(gov)
        await self._session.flush()
        await self._session.refresh(gov)
        return gov

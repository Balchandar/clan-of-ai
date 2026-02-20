from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import AuditAction
from app.domain.orm_models import GovernanceConfigORM
from app.repositories.audit_repository import AuditRepository
from app.repositories.clan_repository import ClanRepository
from app.repositories.governance_repository import GovernanceRepository
from app.logging_config import get_logger

logger = get_logger(__name__)


class GovernanceService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._clan_repo = ClanRepository(session)
        self._governance_repo = GovernanceRepository(session)
        self._audit_repo = AuditRepository(session)

    async def get_governance(self, clan_id: UUID) -> GovernanceConfigORM:
        clan = await self._clan_repo.get_by_id(clan_id)
        if not clan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clan not found")
        return await self._governance_repo.get_or_create_default(clan_id)

    async def update_governance(
        self,
        clan_id: UUID,
        max_retries: int,
        timeout_s: int,
        max_concurrent_executions: int,
        allowed_agent_roles: list[str],
        rules: list[dict],
        require_determinism_verification: bool,
        actor: str = "system",
    ) -> GovernanceConfigORM:
        clan = await self._clan_repo.get_by_id(clan_id)
        if not clan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clan not found")

        gov = await self._governance_repo.upsert(
            clan_id=clan_id,
            max_retries=max_retries,
            timeout_s=timeout_s,
            max_concurrent_executions=max_concurrent_executions,
            allowed_agent_roles=allowed_agent_roles,
            rules=rules,
            require_determinism_verification=require_determinism_verification,
        )

        await self._audit_repo.log(
            action=AuditAction.GOVERNANCE_UPDATED,
            actor=actor,
            clan_id=clan_id,
            payload={
                "max_retries": max_retries,
                "timeout_s": timeout_s,
                "require_determinism_verification": require_determinism_verification,
            },
        )

        logger.info("governance.updated", clan_id=str(clan_id))
        return gov

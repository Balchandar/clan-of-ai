from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import AuditAction
from app.domain.orm_models import ClanAgentORM, ClanORM
from app.repositories.audit_repository import AuditRepository
from app.repositories.clan_repository import ClanRepository
from app.repositories.governance_repository import GovernanceRepository
from app.logging_config import get_logger

logger = get_logger(__name__)


class ClanService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._clan_repo = ClanRepository(session)
        self._governance_repo = GovernanceRepository(session)
        self._audit_repo = AuditRepository(session)

    async def create_clan(
        self,
        name: str,
        description: str,
        config: dict[str, Any],
        actor: str = "system",
    ) -> ClanORM:
        existing = await self._clan_repo.get_by_name(name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Clan with name '{name}' already exists",
            )
        clan = await self._clan_repo.create(name=name, description=description, config=config)
        await self._governance_repo.get_or_create_default(clan.id)
        await self._audit_repo.log(
            action=AuditAction.CLAN_CREATED,
            actor=actor,
            clan_id=clan.id,
            payload={"name": name},
        )
        logger.info("clan.created", clan_id=str(clan.id), name=name)
        return clan

    async def get_clan(self, clan_id: UUID) -> ClanORM:
        clan = await self._clan_repo.get_by_id(clan_id)
        if not clan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clan not found")
        return clan

    async def list_clans(self, offset: int = 0, limit: int = 50) -> list[ClanORM]:
        return await self._clan_repo.list_all(offset=offset, limit=limit)

    async def delete_clan(self, clan_id: UUID, actor: str = "system") -> None:
        clan = await self.get_clan(clan_id)
        await self._audit_repo.log(
            action=AuditAction.CLAN_DELETED,
            actor=actor,
            clan_id=clan_id,
            payload={"name": clan.name},
        )
        await self._clan_repo.delete(clan)
        logger.info("clan.deleted", clan_id=str(clan_id))

    async def clone_clan(
        self,
        source_clan_id: UUID,
        new_name: str,
        override_config: dict[str, Any],
        actor: str = "system",
    ) -> ClanORM:
        source = await self.get_clan(source_clan_id)

        existing = await self._clan_repo.get_by_name(new_name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Clan with name '{new_name}' already exists",
            )

        merged_config = {**source.config, **override_config}
        new_clan = await self._clan_repo.create(
            name=new_name,
            description=f"Clone of {source.name}: {source.description}",
            config=merged_config,
        )

        for agent in source.agents:
            await self._clan_repo.add_agent(
                clan_id=new_clan.id,
                agent_id=agent.agent_id,
                name=agent.name,
                role=agent.role,
                config=agent.config,
            )

        source_governance = await self._governance_repo.get_by_clan_id(source_clan_id)
        if source_governance:
            await self._governance_repo.upsert(
                clan_id=new_clan.id,
                max_retries=source_governance.max_retries,
                timeout_s=source_governance.timeout_s,
                max_concurrent_executions=source_governance.max_concurrent_executions,
                allowed_agent_roles=source_governance.allowed_agent_roles,
                rules=source_governance.rules,
                require_determinism_verification=source_governance.require_determinism_verification,
            )
        else:
            await self._governance_repo.get_or_create_default(new_clan.id)

        await self._audit_repo.log(
            action=AuditAction.CLAN_CLONED,
            actor=actor,
            clan_id=new_clan.id,
            payload={"source_clan_id": str(source_clan_id), "new_name": new_name},
        )
        logger.info("clan.cloned", source_clan_id=str(source_clan_id), new_clan_id=str(new_clan.id))
        return await self._clan_repo.get_by_id(new_clan.id)

    async def add_agent(
        self,
        clan_id: UUID,
        agent_id: str,
        name: str,
        role: str,
        config: dict[str, Any],
        actor: str = "system",
    ) -> ClanAgentORM:
        await self.get_clan(clan_id)

        existing = await self._clan_repo.get_agent(clan_id, agent_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Agent '{agent_id}' already exists in this clan",
            )

        agent = await self._clan_repo.add_agent(
            clan_id=clan_id,
            agent_id=agent_id,
            name=name,
            role=role,
            config=config,
        )
        await self._audit_repo.log(
            action=AuditAction.AGENT_ADDED,
            actor=actor,
            clan_id=clan_id,
            payload={"agent_id": agent_id, "role": role},
        )
        logger.info("agent.added", clan_id=str(clan_id), agent_id=agent_id)
        return agent

    async def remove_agent(
        self,
        clan_id: UUID,
        agent_id: str,
        actor: str = "system",
    ) -> None:
        await self.get_clan(clan_id)
        agent = await self._clan_repo.get_agent(clan_id, agent_id)
        if not agent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        await self._clan_repo.remove_agent(agent)
        await self._audit_repo.log(
            action=AuditAction.AGENT_REMOVED,
            actor=actor,
            clan_id=clan_id,
            payload={"agent_id": agent_id},
        )
        logger.info("agent.removed", clan_id=str(clan_id), agent_id=agent_id)

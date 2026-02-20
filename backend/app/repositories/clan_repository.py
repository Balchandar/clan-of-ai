from __future__ import annotations

import uuid
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.orm_models import ClanAgentORM, ClanORM
from app.logging_config import get_logger

logger = get_logger(__name__)


class ClanRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, name: str, description: str, config: dict) -> ClanORM:
        clan = ClanORM(
            id=uuid.uuid4(),
            name=name,
            description=description,
            config=config,
        )
        self._session.add(clan)
        await self._session.flush()
        await self._session.refresh(clan)
        return clan

    async def get_by_id(self, clan_id: UUID) -> ClanORM | None:
        result = await self._session.execute(
            select(ClanORM)
            .options(selectinload(ClanORM.agents))
            .where(ClanORM.id == clan_id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> ClanORM | None:
        result = await self._session.execute(
            select(ClanORM).where(ClanORM.name == name)
        )
        return result.scalar_one_or_none()

    async def list_all(self, offset: int = 0, limit: int = 50) -> list[ClanORM]:
        result = await self._session.execute(
            select(ClanORM)
            .options(selectinload(ClanORM.agents))
            .order_by(ClanORM.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def delete(self, clan: ClanORM) -> None:
        await self._session.delete(clan)
        await self._session.flush()

    async def add_agent(
        self,
        clan_id: UUID,
        agent_id: str,
        name: str,
        role: str,
        config: dict,
    ) -> ClanAgentORM:
        agent = ClanAgentORM(
            id=uuid.uuid4(),
            clan_id=clan_id,
            agent_id=agent_id,
            name=name,
            role=role,
            config=config,
        )
        self._session.add(agent)
        await self._session.flush()
        await self._session.refresh(agent)
        return agent

    async def get_agent(self, clan_id: UUID, agent_id: str) -> ClanAgentORM | None:
        result = await self._session.execute(
            select(ClanAgentORM).where(
                ClanAgentORM.clan_id == clan_id,
                ClanAgentORM.agent_id == agent_id,
            )
        )
        return result.scalar_one_or_none()

    async def remove_agent(self, agent: ClanAgentORM) -> None:
        await self._session.delete(agent)
        await self._session.flush()

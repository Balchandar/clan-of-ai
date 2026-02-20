from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_clan_service
from app.schemas.clan import AgentCreateRequest, AgentResponse
from app.services.clan_service import ClanService

router = APIRouter(prefix="/clans", tags=["Agents"])


@router.post("/{clan_id}/agents", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def add_agent(
    clan_id: UUID,
    body: AgentCreateRequest,
    service: ClanService = Depends(get_clan_service),
) -> AgentResponse:
    agent = await service.add_agent(
        clan_id=clan_id,
        agent_id=body.agent_id,
        name=body.name,
        role=body.role,
        config=body.config,
    )
    return AgentResponse(
        id=agent.id,
        clan_id=agent.clan_id,
        agent_id=agent.agent_id,
        name=agent.name,
        role=agent.role,
        config=agent.config,
        created_at=agent.created_at,
    )


@router.delete("/{clan_id}/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_agent(
    clan_id: UUID,
    agent_id: str,
    service: ClanService = Depends(get_clan_service),
) -> None:
    await service.remove_agent(clan_id=clan_id, agent_id=agent_id)

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import get_clan_service
from app.domain.orm_models import ClanORM
from app.schemas.clan import (
    ClanCloneRequest,
    ClanCreateRequest,
    ClanListResponse,
    ClanResponse,
)
from app.services.clan_service import ClanService

router = APIRouter(prefix="/clans", tags=["Clans"])


def _to_clan_response(clan: ClanORM) -> ClanResponse:
    from app.schemas.clan import AgentResponse
    agents = [
        AgentResponse(
            id=a.id,
            clan_id=a.clan_id,
            agent_id=a.agent_id,
            name=a.name,
            role=a.role,
            config=a.config,
            created_at=a.created_at,
        )
        for a in (clan.agents or [])
    ]
    return ClanResponse(
        id=clan.id,
        name=clan.name,
        description=clan.description,
        config=clan.config,
        agents=agents,
        created_at=clan.created_at,
        updated_at=clan.updated_at,
    )


@router.post("", response_model=ClanResponse, status_code=status.HTTP_201_CREATED)
async def create_clan(
    body: ClanCreateRequest,
    service: ClanService = Depends(get_clan_service),
) -> ClanResponse:
    clan = await service.create_clan(
        name=body.name,
        description=body.description,
        config=body.config,
    )
    return _to_clan_response(clan)


@router.get("", response_model=list[ClanListResponse])
async def list_clans(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    service: ClanService = Depends(get_clan_service),
) -> list[ClanListResponse]:
    clans = await service.list_clans(offset=offset, limit=limit)
    return [
        ClanListResponse(
            id=c.id,
            name=c.name,
            description=c.description,
            agent_count=len(c.agents or []),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in clans
    ]


@router.get("/{clan_id}", response_model=ClanResponse)
async def get_clan(
    clan_id: UUID,
    service: ClanService = Depends(get_clan_service),
) -> ClanResponse:
    clan = await service.get_clan(clan_id)
    return _to_clan_response(clan)


@router.delete("/{clan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_clan(
    clan_id: UUID,
    service: ClanService = Depends(get_clan_service),
) -> None:
    await service.delete_clan(clan_id)


@router.post("/{clan_id}/clone", response_model=ClanResponse, status_code=status.HTTP_201_CREATED)
async def clone_clan(
    clan_id: UUID,
    body: ClanCloneRequest,
    service: ClanService = Depends(get_clan_service),
) -> ClanResponse:
    clan = await service.clone_clan(
        source_clan_id=clan_id,
        new_name=body.new_name,
        override_config=body.override_config,
    )
    return _to_clan_response(clan)

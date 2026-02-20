from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.dependencies import get_governance_service
from app.domain.orm_models import GovernanceConfigORM
from app.schemas.governance import GovernanceResponse, GovernanceRuleResponse, GovernanceUpdateRequest
from app.services.governance_service import GovernanceService

router = APIRouter(prefix="/clans", tags=["Governance"])


def _to_governance_response(gov: GovernanceConfigORM) -> GovernanceResponse:
    rules = [
        GovernanceRuleResponse(
            rule_id=r["rule_id"],
            name=r["name"],
            condition=r["condition"],
            action=r["action"],
            enabled=r.get("enabled", True),
            priority=r.get("priority", 0),
        )
        for r in (gov.rules or [])
    ]
    return GovernanceResponse(
        id=gov.id,
        clan_id=gov.clan_id,
        max_retries=gov.max_retries,
        timeout_s=gov.timeout_s,
        max_concurrent_executions=gov.max_concurrent_executions,
        allowed_agent_roles=gov.allowed_agent_roles,
        rules=rules,
        require_determinism_verification=gov.require_determinism_verification,
        updated_at=gov.updated_at,
    )


@router.get("/{clan_id}/governance", response_model=GovernanceResponse)
async def get_governance(
    clan_id: UUID,
    service: GovernanceService = Depends(get_governance_service),
) -> GovernanceResponse:
    gov = await service.get_governance(clan_id)
    return _to_governance_response(gov)


@router.put("/{clan_id}/governance", response_model=GovernanceResponse)
async def update_governance(
    clan_id: UUID,
    body: GovernanceUpdateRequest,
    service: GovernanceService = Depends(get_governance_service),
) -> GovernanceResponse:
    rules_dicts = [r.model_dump() for r in body.rules]
    gov = await service.update_governance(
        clan_id=clan_id,
        max_retries=body.max_retries,
        timeout_s=body.timeout_s,
        max_concurrent_executions=body.max_concurrent_executions,
        allowed_agent_roles=body.allowed_agent_roles,
        rules=rules_dicts,
        require_determinism_verification=body.require_determinism_verification,
    )
    return _to_governance_response(gov)

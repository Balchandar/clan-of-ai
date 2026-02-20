from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.intentusnet_client import IntentusNetClient, get_intentusnet_client
from app.database import get_db
from app.services.clan_service import ClanService
from app.services.execution_service import ExecutionService
from app.services.governance_service import GovernanceService


def get_clan_service(session: AsyncSession = Depends(get_db)) -> ClanService:
    return ClanService(session)


def get_execution_service(
    session: AsyncSession = Depends(get_db),
    intentusnet: IntentusNetClient = Depends(get_intentusnet_client),
) -> ExecutionService:
    return ExecutionService(session, intentusnet)


def get_governance_service(session: AsyncSession = Depends(get_db)) -> GovernanceService:
    return GovernanceService(session)

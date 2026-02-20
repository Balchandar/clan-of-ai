from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.intentusnet_client import get_intentusnet_client, IntentusNetClient
from app.config import get_settings
from app.database import get_db

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health(
    session: AsyncSession = Depends(get_db),
    intentusnet: IntentusNetClient = Depends(get_intentusnet_client),
) -> dict:
    settings = get_settings()

    db_ok = False
    try:
        await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    intentusnet_ok = await intentusnet.health_check()

    return {
        "status": "healthy" if db_ok else "degraded",
        "version": settings.app_version,
        "environment": settings.environment,
        "dependencies": {
            "database": "ok" if db_ok else "error",
            "intentusnet": "ok" if intentusnet_ok else "unavailable",
        },
    }

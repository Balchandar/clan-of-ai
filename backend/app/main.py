from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.adapters.intentusnet_client import get_intentusnet_client
from app.api.routers import agents, clans, executions, governance, health
from app.config import get_settings
from app.database import engine
from app.domain.orm_models import Base
from app.logging_config import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", app=settings.app_name, version=settings.app_version, env=settings.environment)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    client = get_intentusnet_client()
    await client.close()
    await engine.dispose()
    logger.info("shutdown")


app = FastAPI(
    title="Clan-of-AI API",
    description="Visual Control Plane for Deterministic Multi-Agent AI Systems",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled_exception", path=request.url.path, error=str(exc), exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


app.include_router(health.router)
app.include_router(clans.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(executions.router, prefix="/api/v1")
app.include_router(governance.router, prefix="/api/v1")

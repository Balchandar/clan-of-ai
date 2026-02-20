from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    app_name: str = "Clan-of-AI"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "production"

    # Database
    database_url: str = "postgresql+asyncpg://clanai:clanai@localhost:5432/clanai"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # IntentusNet
    intentusnet_base_url: str = "http://intentusnet:8001"
    intentusnet_timeout_s: float = 60.0
    intentusnet_max_retries: int = 3

    # Security
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    allowed_origins: list[str] = ["http://localhost:3000", "http://ui:3000"]

    # Observability
    log_level: str = "INFO"
    enable_metrics: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()

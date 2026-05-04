from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://stranalyser:password@db:5432/stranalyser"

    # Redis / Celery
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/0"

    # Strava OAuth
    strava_client_id: str = ""
    strava_client_secret: str = ""
    strava_redirect_uri: str = "http://localhost:8080/api/auth/callback"
    strava_auth_url: str = "https://www.strava.com/oauth/authorize"
    strava_token_url: str = "https://www.strava.com/oauth/token"
    strava_api_base: str = "https://www.strava.com/api/v3"

    # AI / Claude
    anthropic_api_key: str = ""
    ai_model: str = "claude-sonnet-4-6"

    # App
    secret_key: str = "dev-secret-key-change-in-production"
    app_port: int = 8080
    debug: bool = False


settings = Settings()

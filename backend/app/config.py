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
    strava_redirect_uri: str = "http://localhost:8000/api/auth/callback"
    frontend_url: str = "http://localhost:5173"
    strava_auth_url: str = "https://www.strava.com/oauth/authorize"
    strava_token_url: str = "https://www.strava.com/oauth/token"
    strava_api_base: str = "https://www.strava.com/api/v3"

    # AI – Provider & Keys
    ai_provider: str = "anthropic"           # "anthropic" oder "google"
    ai_model: str = "claude-sonnet-4-6"      # Modellname des aktiven Providers
    anthropic_api_key: str = ""
    google_api_key: str = ""

    # App
    secret_key: str = "dev-secret-key-change-in-production"
    debug: bool = False


settings = Settings()

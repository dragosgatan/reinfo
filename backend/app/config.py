from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "postgresql+asyncpg://reinfo:reinfo@localhost:5432/reinfo"
    secret_key: str = "change-me-in-production"
    allowed_origins: list[str] = ["http://localhost:3000"]
    data_dir: str = "../data"
    environment: str = "development"
    piston_url: str = "http://localhost:2000"
    sentry_dsn: str = ""
    cookie_domain: str = ""
    enable_dataset_repro: bool = False
    resend_api_key: str = ""
    email_from: str = "ReInfo <onboarding@resend.dev>"
    frontend_url: str = "http://localhost:3000"
    enable_github_integration: bool = False
    openrouter_api_key: str = ""
    chatbot_daily_limit: int = 10
    chatbot_burst_limit: int = 3
    chatbot_burst_window_seconds: int = 60


settings = Settings()

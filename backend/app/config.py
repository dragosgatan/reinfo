from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "postgresql+asyncpg://reinfo:reinfo@localhost:5432/reinfo"
    secret_key: str = "change-me-in-production"
    allowed_origins: list[str] = ["http://localhost:3000"]
    data_dir: str = "../data"
    environment: str = "development"


settings = Settings()

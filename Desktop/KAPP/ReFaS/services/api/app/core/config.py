import os


def _parse_csv_env(var_name: str, default: str) -> list[str]:
    raw = os.getenv(var_name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _parse_bool_env(var_name: str, default: bool) -> bool:
    raw = os.getenv(var_name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    ENV: str = os.getenv("ENV", "development")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecretkey")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/farmplatform")
    RATE_LIMIT_API_WRITE_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_API_WRITE_PER_MINUTE", "120"))
    CORS_ALLOWED_ORIGINS: list[str] = _parse_csv_env(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:5175",
    )
    CORS_ALLOWED_METHODS: list[str] = _parse_csv_env(
        "CORS_ALLOWED_METHODS",
        "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    )
    CORS_ALLOWED_HEADERS: list[str] = _parse_csv_env(
        "CORS_ALLOWED_HEADERS",
        "Authorization,Content-Type,X-Trace-Id",
    )
    TRUSTED_HOSTS: list[str] = _parse_csv_env("TRUSTED_HOSTS", "localhost,127.0.0.1")
    SECURITY_HEADERS_ENABLED: bool = _parse_bool_env("SECURITY_HEADERS_ENABLED", True)
    HSTS_ENABLED: bool = _parse_bool_env("HSTS_ENABLED", False)
    HSTS_MAX_AGE_SECONDS: int = int(os.getenv("HSTS_MAX_AGE_SECONDS", "31536000"))
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2")
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "ollama")
    AI_BASE_URL: str = os.getenv("AI_BASE_URL", OLLAMA_BASE_URL)
    AI_MODEL: str = os.getenv("AI_MODEL", OLLAMA_MODEL)
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")


settings = Settings()

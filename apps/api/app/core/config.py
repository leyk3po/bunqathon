import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env", override=True)
_DEFAULT_BUNQ_CONTEXT_FILE = str(Path(__file__).resolve().parent.parent.parent / ".bunq_context.json")


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "FlashDrop API")
    app_env: str = os.getenv("APP_ENV", "development")
    port: int = int(os.getenv("PORT", "8000"))
    database_url: str = os.getenv("DATABASE_URL", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    anthropic_api_url: str = os.getenv("ANTHROPIC_API_URL", "https://api.anthropic.com/v1/messages")
    anthropic_timeout_seconds: float = float(os.getenv("ANTHROPIC_TIMEOUT_SECONDS", "20"))
    bunq_api_key: str = os.getenv("BUNQ_API_KEY", "")
    bunq_sandbox: bool = os.getenv("BUNQ_SANDBOX", "true").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    bunq_callback_url: str = os.getenv("BUNQ_CALLBACK_URL", "").strip()
    bunq_context_file: str = os.getenv("BUNQ_CONTEXT_FILE", "").strip() or _DEFAULT_BUNQ_CONTEXT_FILE
    bunq_permitted_ips: tuple[str, ...] = tuple(
        ip.strip()
        for ip in os.getenv("BUNQ_PERMITTED_IPS", "").split(",")
        if ip.strip()
    )
    bunq_monetary_account_id: int | None = (
        int(os.getenv("BUNQ_MONETARY_ACCOUNT_ID", "").strip())
        if os.getenv("BUNQ_MONETARY_ACCOUNT_ID", "").strip()
        else None
    )
    bunq_timeout_seconds: float = float(os.getenv("BUNQ_TIMEOUT_SECONDS", "20"))
    bunq_redirect_base_url: str = os.getenv("BUNQ_REDIRECT_BASE_URL", "").strip()
    s3_bucket_name: str = os.getenv("S3_BUCKET_NAME", "")
    s3_region: str = os.getenv("AWS_DEFAULT_REGION", os.getenv("AWS_REGION", "us-east-1"))
    s3_media_prefix: str = os.getenv("S3_MEDIA_PREFIX", "uploads")
    cors_origins: list[str] = field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ]
    )


settings = Settings()

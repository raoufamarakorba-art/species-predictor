import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


SERVER_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = SERVER_DIR.parent

load_dotenv(ROOT_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    port: int = int(os.getenv("PORT", "8000"))
    allowed_origin: str = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")
    node_env: str = os.getenv("NODE_ENV", "development")
    inaturalist_cache_ttl_seconds: int = int(os.getenv("INATURALIST_CACHE_TTL_SECONDS", "300"))
    public_dir: Path = SERVER_DIR / "public"


settings = Settings()

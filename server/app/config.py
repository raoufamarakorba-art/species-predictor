import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


SERVER_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = SERVER_DIR.parent

load_dotenv(ROOT_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "mistral")
    ollama_timeout_seconds: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))
    ollama_num_predict: int = int(os.getenv("OLLAMA_NUM_PREDICT", "1200"))
    port: int = int(os.getenv("PORT", "8000"))
    allowed_origin: str = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")
    node_env: str = os.getenv("NODE_ENV", "development")
    inaturalist_cache_ttl_seconds: int = int(os.getenv("INATURALIST_CACHE_TTL_SECONDS", "300"))
    public_dir: Path = SERVER_DIR / "public"


settings = Settings()

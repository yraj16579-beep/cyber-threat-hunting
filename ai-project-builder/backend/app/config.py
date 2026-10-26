import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    ai_api_key: str = os.getenv("AI_API_KEY", "")
    ai_base_url: str = os.getenv("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    ai_model: str = os.getenv("AI_MODEL", "gpt-4o-mini")
    github_client_id: str = os.getenv("GITHUB_CLIENT_ID", "")
    github_client_secret: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    github_callback_url: str = os.getenv("GITHUB_CALLBACK_URL", "http://localhost:8000/api/github/callback")
    session_secret: str = os.getenv("SESSION_SECRET", "dev-only-change-this-secret")
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    backend_origin: str = os.getenv("BACKEND_ORIGIN", "http://localhost:8000")
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "10"))

settings = Settings()

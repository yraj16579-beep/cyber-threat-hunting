import re
from pathlib import PurePosixPath

BLOCKED_NAMES = {".env", ".env.local", ".env.production", "id_rsa", "id_ed25519"}
BLOCKED_PARTS = {"node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "build", ".pytest_cache"}

def safe_project_path(value: str) -> str:
    if not isinstance(value, str) or not value or len(value) > 240:
        raise ValueError("Invalid file path")
    path = value.replace("\\", "/")
    p = PurePosixPath(path)
    if path.startswith("/") or re.match(r"^[A-Za-z]:", path) or any(part in ("", ".", "..") for part in path.split("/")):
        raise ValueError("Unsafe file path")
    if any(part.lower() in BLOCKED_PARTS for part in p.parts):
        raise ValueError("Generated path contains a prohibited directory")
    if p.name.lower() in BLOCKED_NAMES or p.name.lower().startswith(".env.") and p.name.lower() != ".env.example":
        raise ValueError("Secret or environment files cannot be generated/published")
    if p.name.lower() in {".gitignore"}:
        return path
    return path

def sanitize_files(raw_files):
    if not isinstance(raw_files, list) or not raw_files:
        raise ValueError("AI provider returned no files")
    clean = {}
    total = 0
    for item in raw_files:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str) or not isinstance(item.get("content"), str):
            continue
        path = safe_project_path(item["path"].strip())
        content = item["content"]
        total += len(content.encode("utf-8"))
        if len(content) > 500_000:
            raise ValueError(f"File is too large: {path}")
        clean[path] = content
    if not clean:
        raise ValueError("AI provider returned no valid files")
    if len(clean) > 150 or total > 5_000_000:
        raise ValueError("Generated project exceeds file or size limits")
    return clean

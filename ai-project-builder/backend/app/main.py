import io
import json
import secrets
import uuid
import zipfile
from urllib.parse import urlencode
from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import RedirectResponse, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import httpx

from .config import settings
from .schemas import AnalyzeRequest, GenerateRequest, PublishRequest
from .security import sanitize_files
from .services import call_ai, extract_upload
from .github_service import list_repositories, publish_files, GitHubError

app = FastAPI(title="AI Project Builder API", version="1.0.0")
app.add_middleware(
    SessionMiddleware, secret_key=settings.session_secret, session_cookie="aipb_session",
    same_site="lax", https_only=settings.backend_origin.startswith("https://"), max_age=60*60*8
)
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=True, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

# In-memory for local starter. Use a database/Redis for production.
PROJECTS = {}
# OAuth access tokens stay server-side; Starlette's default session cookie is signed, not encrypted.
GITHUB_TOKENS = {}

def owner_id(request: Request):
    if "session_user" not in request.session:
        request.session["session_user"] = secrets.token_urlsafe(24)
    return request.session["session_user"]

def get_project(request: Request, project_id: str):
    project = PROJECTS.get(project_id)
    if not project or project["owner_id"] != owner_id(request):
        raise HTTPException(404, "Project not found in this session")
    return project

@app.get("/api/health")
async def health():
    return {"status": "ok", "ai_configured": bool(settings.ai_api_key), "github_configured": bool(settings.github_client_id and settings.github_client_secret)}

@app.post("/api/projects/analyze")
async def analyze(body: AnalyzeRequest):
    topic = body.topic.strip()
    if len(topic) < 5:
        raise HTTPException(422, "Please provide a more detailed project specification.")
    return {"summary": topic[:500], "suggested_stack": body.stack, "requirements": ["Source code", "README.md", ".gitignore", ".env.example"], "message": "Specification accepted. Generate to create project files."}

@app.post("/api/projects/upload")
async def upload_spec(file: UploadFile = File(...)):
    content = await file.read()
    try:
        extracted = await extract_upload(file.filename or "", file.content_type or "", content)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    if not extracted.strip():
        raise HTTPException(400, "No text could be extracted from the uploaded file.")
    return {"filename": file.filename, "text": extracted[:50000]}

@app.post("/api/projects/generate")
async def generate(body: GenerateRequest, request: Request):
    try:
        raw = await call_ai(body.topic.strip(), body.stack, body.project_name)
        files = sanitize_files(raw)
    except ValueError as exc:
        raise HTTPException(502, str(exc))
    except RuntimeError as exc:
        raise HTTPException(502, str(exc))
    project_id = str(uuid.uuid4())
    PROJECTS[project_id] = {
        "owner_id": owner_id(request), "name": body.project_name, "stack": body.stack,
        "files": files, "created_at": __import__("datetime").datetime.utcnow().isoformat() + "Z"
    }
    return {"project_id": project_id, "name": body.project_name, "stack": body.stack,
            "file_count": len(files), "files": [{"path": p, "size": len(c.encode("utf-8"))} for p,c in sorted(files.items())]}

@app.get("/api/projects/{project_id}/files")
async def project_files(project_id: str, request: Request):
    project = get_project(request, project_id)
    return {"project_id": project_id, "files": [{"path": p, "content": c, "size": len(c.encode("utf-8"))} for p,c in sorted(project["files"].items())]}

@app.get("/api/projects/{project_id}/download")
async def download(project_id: str, request: Request):
    project = get_project(request, project_id)
    blocked_parts = {"node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "build", ".pytest_cache"}
    blocked_names = {".env", ".env.local", ".env.production", "id_rsa", "id_ed25519"}
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, content in project["files"].items():
            parts = path.replace("\\", "/").split("/")
            if any(part.lower() in blocked_parts for part in parts) or parts[-1].lower() in blocked_names:
                continue
            if parts[-1].lower().startswith(".env.") and parts[-1].lower() != ".env.example":
                continue
            archive.writestr(f'{project["name"]}/{path}', content)
    buffer.seek(0)
    filename = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in project["name"]) + ".zip"
    return StreamingResponse(buffer, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{filename}"'})

@app.get("/api/github/login")
async def github_login(request: Request):
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(503, "GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to backend/.env.")
    state = secrets.token_urlsafe(32)
    request.session["github_oauth_state"] = state
    params = {"client_id": settings.github_client_id, "redirect_uri": settings.github_callback_url, "scope": "repo", "state": state}
    return RedirectResponse("https://github.com/login/oauth/authorize?" + urlencode(params))

@app.get("/api/github/callback")
async def github_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    if error:
        raise HTTPException(400, f"GitHub authorization cancelled or denied: {error}")
    expected = request.session.pop("github_oauth_state", None)
    if not expected or not state or not secrets.compare_digest(expected, state):
        raise HTTPException(400, "OAuth state validation failed. Please connect GitHub again.")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post("https://github.com/login/oauth/access_token", headers={"Accept": "application/json"}, json={
            "client_id": settings.github_client_id, "client_secret": settings.github_client_secret, "code": code,
            "redirect_uri": settings.github_callback_url, "state": state
        })
    data = response.json()
    if response.status_code >= 400 or data.get("error") or not data.get("access_token"):
        raise HTTPException(502, "GitHub OAuth exchange failed. Check OAuth app configuration and callback URL.")
    GITHUB_TOKENS[owner_id(request)] = data["access_token"]
    return RedirectResponse(settings.frontend_origin + "/?github=connected")

@app.get("/api/github/status")
async def github_status(request: Request):
    token = GITHUB_TOKENS.get(owner_id(request))
    if not token:
        return {"connected": False}
    try:
        from .github_service import github_request
        user = await github_request("GET", "/user", token)
        return {"connected": True, "login": user.get("login"), "avatar_url": user.get("avatar_url")}
    except GitHubError:
        GITHUB_TOKENS.pop(owner_id(request), None)
        return {"connected": False}

@app.post("/api/github/logout")
async def github_logout(request: Request):
    GITHUB_TOKENS.pop(owner_id(request), None)
    return {"connected": False}

@app.get("/api/github/repositories")
async def github_repositories(request: Request):
    token = GITHUB_TOKENS.get(owner_id(request))
    if not token:
        raise HTTPException(401, "Connect GitHub first.")
    try:
        return {"repositories": await list_repositories(token)}
    except GitHubError as exc:
        raise HTTPException(502, str(exc))

@app.post("/api/github/publish")
async def github_publish(body: PublishRequest, request: Request):
    if not body.confirmed:
        raise HTTPException(400, "Publishing requires explicit confirmation.")
    project = get_project(request, body.project_id)
    token = GITHUB_TOKENS.get(owner_id(request))
    if not token:
        raise HTTPException(401, "Connect GitHub first.")
    if body.create_repo:
        # Prevent creating a repository under a different account than the authenticated user.
        from .github_service import github_request
        try:
            user = await github_request("GET", "/user", token)
        except GitHubError as exc:
            raise HTTPException(502, str(exc))
        if user.get("login", "").lower() != body.owner.lower():
            raise HTTPException(400, "New repositories must be created under the authenticated account.")
    try:
        result = await publish_files(token, body.owner, body.repo, body.branch, project["files"],
                                    create_repo=body.create_repo, description=body.description, private=body.private)
        return {"success": True, **result, "file_count": len(project["files"])}
    except GitHubError as exc:
        raise HTTPException(502, str(exc))

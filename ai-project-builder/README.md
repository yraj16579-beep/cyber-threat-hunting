# AI Project Builder

A full-stack React + Vite frontend and FastAPI backend that turns a project specification into a downloadable codebase and can publish it to GitHub after OAuth authorization.

## Features
- Topic/specification input and uploads (`.txt`, `.pdf`, `.docx`, common images).
- Server-side AI generation using an OpenAI-compatible chat-completions API.
- Project file tree and code preview.
- ZIP download with secret/build/cache exclusions.
- GitHub OAuth, repository listing, repository creation, and publishing commits.
- Session-based project ownership, CSRF-style OAuth state validation, input limits, path validation, and publish confirmation.

## Requirements
- Python 3.11+
- Node.js 20+
- An AI provider API key (OpenAI-compatible endpoint)
- A GitHub OAuth App (for GitHub publishing)

## Setup

### 1. Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
Edit `backend/.env`:
- `AI_API_KEY`: your provider key
- `AI_BASE_URL`: defaults to OpenAI API base URL
- `AI_MODEL`: model available to your provider
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: from your GitHub OAuth App
- `SESSION_SECRET`: replace with a long random secret
- `FRONTEND_ORIGIN`: usually `http://localhost:5173`
- `BACKEND_ORIGIN`: usually `http://localhost:8000`

For GitHub OAuth App callback URL, set:
`http://localhost:8000/api/github/callback`

Start backend:
```bash
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

## Usage
1. Enter a topic or upload a specification.
2. Select the target stack and generate.
3. Inspect files in the tree, preview code, and download the ZIP.
4. Connect GitHub, select an existing repository or create a new one, review the file list, confirm publishing, and publish.

## AI output format
The backend asks the model for JSON with a `files` array of `{ "path": "...", "content": "..." }`. It validates every path and rejects unsafe files. Model output is not guaranteed to compile; review and test generated code before production use.

## Security notes
- API keys and OAuth secrets remain on the backend.
- Never commit `.env`; `.env.example` is allowed.
- Session cookie is HTTP-only, SameSite=Lax, and Secure in production.
- Use HTTPS, a persistent session store, a reverse proxy, rate limiting, and a production-grade secret manager before deployment.
- This demo stores generated projects in process memory. Restarting the backend clears them. Use persistent storage for production.
- GitHub OAuth scope `repo` is required to publish to private repositories and create repositories using the standard OAuth App flow. If only public repositories are needed, consider a GitHub App with narrower repository permissions.
- GitHub publishing requires the user to authorize the app and explicitly confirm the destination and file list.

## Tests
```bash
cd backend
pytest
```

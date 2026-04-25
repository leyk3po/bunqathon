# Local Setup

This document covers the local development setup for the `bunqathon` monorepo.

It does not describe product features. It only explains how to get the current scaffold running:

- React frontend in `apps/web`
- FastAPI backend in `apps/api`
- optional local PostgreSQL via Docker

## Repo structure

```text
bunqathon/
  apps/
    api/
    web/
  docker-compose.yml
  package.json
  SETUP.md
```

The separate `PSD2-Implementation-for-bunq-API` directory is a reference repo and is not part of this monorepo setup.

## Requirements

Install these first:

- Node.js 18+
- npm
- Python 3.10+
- Docker Desktop, only if you want local Postgres

## Frontend setup

The frontend is a React app using Vite.

### Run frontend

```bash
cd apps/web
npm install
npm run dev
```

Frontend URL:

- `http://localhost:5173`

### Frontend env

Create a local env file:

```bash
cp .env.example .env
```

Default value:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Backend setup

The backend is a FastAPI app.

### Important migration note

The backend now uses Alembic migrations for schema management.

That means:

- the app no longer creates tables automatically on startup
- after setting up the backend environment, run the migration command before using drop or payment endpoints

### Backend env

From `apps/api`:

```bash
cp .env.example .env
```

Default file:

```env
APP_NAME=FlashDrop API
APP_ENV=development
PORT=8000
DATABASE_URL=
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

You can leave `DATABASE_URL` empty at first. The API still starts. The database health endpoint will just report unavailable until you configure Postgres.

## Backend setup in Git Bash

Use this if your terminal is Git Bash.

```bash
cd apps/api
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
python -m alembic upgrade head
uvicorn app.main:app --reload
```

Backend URLs:

- API root: `http://127.0.0.1:8000/`
- Docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`
- DB health: `http://127.0.0.1:8000/health/database`

## Backend setup in PowerShell

Use this if your terminal is PowerShell.

```powershell
cd apps/api
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m alembic upgrade head
uvicorn app.main:app --reload
```

## Database migrations

Run these from `apps/api`.

### Apply migrations

```bash
python -m alembic upgrade head
```

### Create a new migration

```bash
python -m alembic revision --autogenerate -m "describe change"
```

### Roll back one migration

```bash
python -m alembic downgrade -1
```

Migration files live in:

- `apps/api/alembic/versions`

## Why `Activate.ps1` failed in Git Bash

If you run:

```bash
.venv\Scripts\Activate.ps1
```

inside Git Bash, it fails because `Activate.ps1` is a PowerShell script, not a Bash script.

In Git Bash, use:

```bash
source .venv/Scripts/activate
```

In PowerShell, use:

```powershell
. .\.venv\Scripts\Activate.ps1
```

## Database setup

Docker is optional right now.

You only need Docker if you want a real local PostgreSQL instance. The FastAPI scaffold is intentionally set up so it can start without a database during early development.

## Start PostgreSQL with Docker

From the repo root:

```bash
docker compose up -d db
```

This uses the `db` service in `docker-compose.yml`.

Exposed port:

- `5432`

Default database credentials:

```text
database: flashdrop
user: flashdrop
password: flashdrop
host: localhost
port: 5432
```

### Backend DB env

Put this in `apps/api/.env` when Postgres is running:

```env
DATABASE_URL=postgresql+psycopg://flashdrop:flashdrop@localhost:5432/flashdrop
```

Then restart the backend if needed.

### Stop the database

From the repo root:

```bash
docker compose stop db
```

### Remove the database container

```bash
docker compose down
```

### Remove the database container and volume

This deletes local DB data.

```bash
docker compose down -v
```

## Recommended local workflow

### Option 1: no database yet

Use this when you only want the scaffold running:

1. Start backend without `DATABASE_URL`
2. Start frontend
3. Use `/health` and `/docs` to confirm the API is up

### Option 2: with local Postgres

Use this when you want backend persistence work to begin:

1. Run `docker compose up -d db` from the repo root
2. Set `DATABASE_URL` in `apps/api/.env`
3. Run `python -m alembic upgrade head`
4. Start or restart the backend
5. Check `http://127.0.0.1:8000/api/v1/health/database`

## Root scripts

There is a root `package.json` with workspace scripts for the frontend:

```bash
npm run dev:web
npm run build:web
npm run preview:web
```

Run these from the repo root.

## Current scaffold

### Frontend

- React 18
- Vite
- TypeScript
- starter page in `apps/web/src/App.tsx`

### Backend

- FastAPI
- CORS configured for local frontend
- health endpoints
- optional database connection check

## Troubleshooting

### Backend starts but DB health says unavailable

That is expected if `DATABASE_URL` is empty.

### `bash: .venvScriptsActivate.ps1: command not found`

You are in Git Bash and trying to run a PowerShell activation script. Use:

```bash
source .venv/Scripts/activate
```

### Uvicorn crashed with a dataclass mutable default error

That issue was fixed in `apps/api/app/config.py`. If you still see it, make sure you are running the latest local files.

### Frontend cannot reach backend

Check:

- frontend env is `VITE_API_BASE_URL=http://localhost:8000`
- backend is running on port `8000`
- `CORS_ORIGINS` includes `http://localhost:5173`

### `pip` says a new version is available

That is only a notice. It does not block local development.

If you want to update:

```bash
python -m pip install --upgrade pip
```

## Useful URLs

- Frontend: `http://localhost:5173`
- API root: `http://127.0.0.1:8000/`
- API docs: `http://127.0.0.1:8000/docs`
- API health: `http://127.0.0.1:8000/api/v1/health`
- API DB health: `http://127.0.0.1:8000/api/v1/health/database`

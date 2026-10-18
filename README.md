# FindBack

**A Cloud-Based Missing Person and Community Alert Network**

[![CI](https://github.com/Shariar-Joy/FindBack/actions/workflows/ci.yml/badge.svg)](https://github.com/Shariar-Joy/FindBack/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&logoColor=white)](backend/pyproject.toml)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](frontend/package.json)
[![Rights](https://img.shields.io/badge/license-All_rights_reserved-lightgrey)](LICENSE)

A React/TypeScript and FastAPI application for private reporting, moderated public cases, private sightings, district subscriptions, asynchronous email, and audited administration. Built for a university cloud computing project from the included project plan.

[Local setup](#local-installation-windows-powershell) · [AWS deployment](docs/AWS_DEPLOYMENT.md) · [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Testing](docs/TESTING.md) · [Project review](docs/PROJECT_REVIEW.md)

**Status:** Core workflows pass local integration and browser checks. AWS deployment artifacts are supplied; live cloud deployment, provider verification, and backup restoration remain to be completed in the target account. See [implementation status](IMPLEMENTATION_STATUS.md).

![FindBack dashboard with fictional demonstration cases](docs/screenshots/dashboard-desktop.png)

FindBack is a community assistance platform, not an official emergency response service. Approval means approved for publication, not officially verified. Use fictional data for this educational project.

## Features

- Public dashboard with database statistics, approved cases, alerts and quick actions.
- Registration, Argon2id passwords, HTTP-only session cookies, CSRF protection, password recovery and account settings.
- Four-step missing-person form with validation, optional sanitized photographs, private case tracking, corrections and removal requests.
- Server-filtered, paginated directory; public details, copying and printing; Leaflet/OpenStreetMap map with clustering and approved district centroids.
- Private sightings and supporting photographs; authorized reviewer notifications and review notes.
- Multi-district subscriptions, email preferences and notification history.
- Moderator approval/rejection/correction/duplicate decisions, hiding, resolution, and concerns/removal review.
- Admin account roles/suspension, real Recharts analytics, audit history, queue monitoring and failed-job retries.
- Durable PostgreSQL transactional outbox, worker leases, exponential retries, demo safeguards and local Mailpit capture.
- Local and private S3-compatible storage adapters, Docker services, migration, synthetic seed, tests and actual local performance measurements.

## Stack and structure

Frontend: React 19, Vite, strict TypeScript, Tailwind 4, React Router, TanStack Query, Axios, React Hook Form, Zod, Lucide, Recharts, React Leaflet, Motion and Sonner. Inter is bundled locally.

Backend: Python 3.12+, FastAPI, SQLAlchemy 2.x, Pydantic, Alembic, PostgreSQL, Argon2id, Pillow, boto3 and a standalone worker. PostgreSQL serves as the reliable queue as well as the primary database; Redis is not required.

```text
frontend/src/      pages, reusable components, services, auth context and routes
backend/app/       API modules, core security/config, models, schemas, services, storage, worker
backend/alembic/   versioned schema
backend/tests/     privacy, auth, workflow, storage and queue integration tests
frontend/e2e/      Playwright workflow and responsive smoke checks
infrastructure/   AWS production Compose, environment/IAM examples, other provider templates
scripts/          local startup, isolated E2E, k6 and measured experiments
docs/             architecture, ER diagram, deployment, API, testing and measurements
.github/          CI, dependency updates, issue and pull request templates
```

## Local installation (Windows PowerShell)

Prerequisites: Python 3.12+, Node 22.12+ or 24, npm, and Docker Desktop running Linux containers. Ports 5432, 1025, 8025, 8000 and 5173 must be available. No paid services or cloud credentials are needed.

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
.\.venv\Scripts\python.exe -m pip install --no-deps -e ./backend
Copy-Item .env.example .env
cd frontend
npm ci
cd ..
docker compose up -d db mailpit --wait
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
cd ..
```

A fresh checkout starts without records. Preserve an existing `.env` if you already configured your local installation.

Start all three application processes with:

```powershell
.\scripts\start-local.ps1
```

Visit **http://127.0.0.1:5173**. API documentation: **http://127.0.0.1:8000/api/docs**. Local captured email: **http://127.0.0.1:8025**. Stop application processes with `./scripts/stop-local.ps1`; persistent containers can be stopped with `docker compose stop`. Database and media volumes survive a normal stop.

For separate terminals, run from `backend`:

```powershell
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
..\.venv\Scripts\python.exe -m app.workers.notifications
```

Run `npm run dev` from `frontend` in a third terminal. On Linux/macOS, use `.venv/bin/python` in place of the Windows interpreter path.

Alternatively, `docker compose up --build -d` runs PostgreSQL, Mailpit, migration, API and worker in containers; run the frontend separately. This root Compose configuration is for local development. The separate [AWS configuration](infrastructure/aws/compose.production.yml) includes the frontend reverse proxy and uses managed external services.

## Environment configuration

See [.env.example](.env.example) and [frontend/.env.example](frontend/.env.example). Backend commands run from `backend` and load the root `.env`. Shell environment values take precedence. Never commit `.env` or credentials.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy `postgresql+psycopg` URL; loopback IPv4 avoids slow localhost IPv6 resolution on this host |
| `FRONTEND_URL`, `ALLOWED_ORIGINS` | Exact frontend URL and comma-separated allowlist; no wildcard credentials |
| `COOKIE_SECURE` | False for local HTTP; must be true for production HTTPS |
| `STORAGE_BACKEND`, `STORAGE_PATH` | Local private image directory in development |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT_URL` | Private S3 or compatible production storage |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Server-only credentials or use an IAM role |
| `EMAIL_BACKEND`, `SMTP_*`, `EMAIL_FROM` | SMTP service; local default is Mailpit on port 1025 |
| `ALLOW_DEMO_EMAIL` | False by default; enable only for a controlled local test sink |
| `WORKER_MAX_ATTEMPTS`, `WORKER_LEASE_SECONDS` | Retry/lease policy; SMTP timeout is shorter than the lease |
| `VITE_API_URL` | Leave empty for the same-origin API proxy; no secret belongs in a Vite variable |

The logging email adapter is an explicit development alternative: `EMAIL_BACKEND=log` records capture events without message content. It does not deliver reset links; use Mailpit for password recovery testing. Missing external credentials are never represented as configured services.

## Demo records and administrator bootstrap

Set a strong, development-only password in your shell or ignored `.env`, then seed explicitly:

```powershell
$env:DEMO_PASSWORD = 'ChooseYourOwnDemoPassword123'
cd backend
..\.venv\Scripts\python.exe -m app.cli seed
```

Synthetic accounts: `admin@example.com`, `moderator@example.com`, `reporter@example.com`, `subscriber@example.com`. All use your supplied `DEMO_PASSWORD`. Demo records are visibly labeled and use neutral illustrations. Seeding is idempotent and blocked outside development. Newly submitted development reports are also labeled demo.

Demo alerts are cancelled by default. To demonstrate delivery, set `ALLOW_DEMO_EMAIL=true` **only with Mailpit/test SMTP**, restart the worker/API, subscribe a demo user to a district, and approve a new pending report there. Previously cancelled jobs are intentionally not silently replayed.

For a fresh non-demo database, bootstrap the first administrator without public role selection:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = 'your-admin-address@example.com'
$env:BOOTSTRAP_ADMIN_PASSWORD = 'YourUniqueStrongPassword123'
..\.venv\Scripts\python.exe -m app.cli bootstrap-admin
Remove-Item Env:\BOOTSTRAP_ADMIN_PASSWORD
```

The command refuses an existing administrator or implicit promotion of an existing account. Subsequent role changes use audited Admin UI. Do not bootstrap into a seeded demo database for production use.

## Checks and experiments

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q
# Optional: run the same tests in isolated schemas on local PostgreSQL:
$env:TEST_DATABASE_URL = 'postgresql+psycopg://findback:findback_local@127.0.0.1:5432/findback?connect_timeout=5'
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m alembic check
cd ..\frontend
npm test
npm run build
cd ..
.\.venv\Scripts\python.exe scripts\run_e2e.py
.\.venv\Scripts\python.exe scripts\notification_experiment.py
.\.venv\Scripts\python.exe scripts\load_smoke.py
```

The E2E harness uses generated test credentials, a disposable PostgreSQL schema, ports 8010/5174, and Mailpit. It cleans up its own services/schema and leaves primary local data alone. It uses an existing cached Windows Chromium where available, or `PLAYWRIGHT_EXECUTABLE_PATH`. On another machine, install a compatible browser with `npx playwright install chromium` from `frontend` (`--with-deps` on Linux when necessary).

Optional k6 scenario: `k6 run scripts/load.js`. It is supplied separately from the measured Python HTTP smoke run. See [testing](docs/TESTING.md), [measured results](docs/PERFORMANCE.md), and [implementation status](IMPLEMENTATION_STATUS.md) for exact verification and limitations.

## Cloud deployment and security

[AWS deployment](docs/AWS_DEPLOYMENT.md) covers EC2 Docker containers, an HTTPS ALB, RDS PostgreSQL, private S3, SES SMTP, IAM, monitoring, and backups. The [alternative provider guide](docs/DEPLOYMENT.md) covers Vercel + Render + Neon. Configuration is under `infrastructure`; it does not provision services. No live cloud deployment is claimed.

[Architecture](docs/ARCHITECTURE.md), [database ER diagram](docs/DATABASE.md), [API guide](docs/API.md) and generated [OpenAPI schema](docs/openapi.json) describe the implementation. Session/ownership/role checks run in FastAPI. Public fields are allowlisted, exact locations are never collected, images are re-encoded, and pending media stays private. SMTP delivery is at-least-once; see the architecture's crash-window explanation.

Before collecting real reports, an operator must establish real support and retention arrangements, verify provider security/configuration and backups, test restore and external adapters, and obtain an independent application review. The application does not claim those deployment tasks have already happened.

## Documentation

| Guide | Contents |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | Components, privacy boundaries, outbox and delivery guarantees |
| [Database](docs/DATABASE.md) | ER diagram, records, indexes and migrations |
| [API](docs/API.md) | Endpoint groups, authentication, errors and OpenAPI |
| [AWS deployment](docs/AWS_DEPLOYMENT.md) | AWS topology, production configuration and release steps |
| [Other providers](docs/DEPLOYMENT.md) | Alternative hosting and operational checks |
| [Testing](docs/TESTING.md) | Unit/integration/browser checks and CI |
| [Performance](docs/PERFORMANCE.md) | Previously measured local experiments and their limits |
| [Project review](docs/PROJECT_REVIEW.md) | Cleanup decisions, fixes, verification and remaining work |

## Repository workflow

CI runs PostgreSQL/migration tests, frontend tests/build, browser workflows, container
builds, and repository hygiene checks on pushes and pull requests. Dependabot checks
dependencies weekly and GitHub Actions monthly. Use feature branches and pull requests;
see [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md).

## Rights

Copyright © 2026 Shariar Joy. **All rights reserved.** Public visibility permits
inspection under GitHub's platform terms; it does not grant a general reuse or
redistribution license. See [LICENSE](LICENSE). Third-party libraries and assets
retain their own licenses.

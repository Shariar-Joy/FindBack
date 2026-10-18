# Deployment guide

For AWS, use [AWS deployment](AWS_DEPLOYMENT.md) and `infrastructure/aws/`.
The provider-specific steps below are an alternative deployment path.

No external service has been provisioned or deployed by this implementation. Templates are reviewable starting points; actual account access, current service plans, credentials and deployment authorization are required.

## 1. Database and object storage

Create a Neon PostgreSQL project and obtain its connection string. Use the `postgresql+psycopg://` driver prefix and the provider's required TLS parameters (normally `sslmode=require`; prefer certificate-verifying configuration where supported). Choose a suitable pooled runtime connection and a direct connection for migrations when required by your provider. Bound the total SQLAlchemy connection pool across API and worker replicas.

Create a private S3 bucket or compatible service. Disable public access and ACL-based publication. Grant the backend/worker identity only GetObject, PutObject and DeleteObject for the case-media prefix/bucket. Configure encryption, lifecycle/retention and versioning for the intended region. Set server-only `STORAGE_BACKEND=s3`, bucket, region, optional endpoint and credential chain. The adapter proxies authorized reads rather than exposing bucket URLs. Validate the chosen provider's SSE-AES256 compatibility before use.

## 2. API and worker on Render

Use repository root directory `backend`, install the tested dependency snapshot with `pip install -r requirements.lock.txt` followed by `pip install --no-deps .`, and start `uvicorn app.main:app --host 0.0.0.0 --port $PORT --no-access-log`. Configure `/ready` as the service health path. Run `alembic upgrade head` once per release, before routing traffic. Where a pre-deploy command is unavailable on the selected plan, run the migration as a controlled release step; do not race migrations from multiple API replicas.

Deploy a separate background worker with `python -m app.workers.notifications`. API and worker must share the production database and SMTP environment. They do not share a local filesystem: production uses object storage. An example service definition is `infrastructure/render.yaml.example`; attach an environment group to both services before deploying it.

Required production values include `ENVIRONMENT=production`, `COOKIE_SECURE=true`, an HTTPS `FRONTEND_URL`, exact HTTPS `ALLOWED_ORIGINS`, private S3 configuration, authenticated STARTTLS SMTP and `ALLOW_DEMO_EMAIL=false`. Startup rejects the known local database credential and unsafe development adapter choices. Never put provider keys in a Vite variable, source file, build log or URL.

Rate limiting uses `request.client.host`. Configure the ingress and Uvicorn trusted proxy addresses for your real hosting topology so the application sees a trustworthy client IP. Do not enable arbitrary forwarded headers on a directly exposed origin. Verify this behavior with your ingress; it has not been demonstrated on a cloud deployment here.

## 3. Frontend on Vercel

Select `frontend` as the project root, Vite as the framework, `npm ci` for installation, `npm run build` for building and `dist` as the output directory. Copy `infrastructure/vercel.json.example` to `frontend/vercel.json` and replace the explicit backend placeholder.

Keep `VITE_API_URL` empty. The `/api/:path*` external rewrite makes API calls first-party on the frontend origin; this supports SameSite=Lax cookie sessions without third-party cookies. Ensure API routes precede SPA fallback. The backend must allow the actual frontend origin, including any staging origin you intentionally support. Test HTTP-only cookies, the CSRF cookie/header, no-store headers and logout through the actual rewrite. Do not assume two unrelated provider domains will work with direct cross-site cookie requests.

The frontend header template includes a Content Security Policy for local fonts, bundled scripts, blob previews and OpenStreetMap tiles. Review it when adding a service. The API has no-store and security headers; do not cache authenticated API responses or restricted images at the CDN.

## 4. Email, bootstrap and smoke test

Configure an SMTP provider, verified sender, authenticated TLS and appropriate sender-domain DNS. SMTP timeout is 20 seconds and the default job lease is 120 seconds. Use only a test sink/allowlist during demonstration. Demo content is never sent by a production worker.

On a fresh database, run the documented environment-driven `app.cli bootstrap-admin` command through an authorized private deployment shell. Remove temporary bootstrap secrets afterward. Do not seed production. Use the Admin UI for subsequent role management.

Verify registration/login, authenticated CSRF writes, report ownership, pending privacy, review/approval, approved photo retrieval, map generalization, subscription matching, private sighting access, email delivery, hiding/resolution, audit logs and an unauthorized request. Exercise failed SMTP and a stopped/restarted worker. Use only synthetic records while doing this.

## 5. Operations and backups

Collect JSON API/worker logs and monitor `/health` and `/ready`. Alert on 5xx rate, API p95 latency, failed jobs, old pending jobs and missing worker progress. Inspect restricted operational data only through authorized admin access. Log collection must preserve the application's no-body/no-token policy.

Enable managed database backups and point-in-time recovery according to the chosen plan. Schedule a `pg_dump --format=custom` to encrypted restricted storage if required by your recovery policy. Test restoration into a separate database with `pg_restore`, run migration/readiness and privacy smoke checks there, record the result and securely remove the restored test environment. No backup or restore drill has been executed against a cloud account in this workspace.

Protect object backups/versioning and align retention with case removal obligations. Reconcile orphan objects after interrupted uploads. Define support contact, retention periods, removal identity checks and operator access reviews before using real reports. Test regional catalogs and centroids before adding other countries.

## Official references checked for this guide

- [Vercel external rewrites](https://vercel.com/docs/routing/rewrites)
- [Vite deployments on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Render deployment lifecycle and pre-deploy availability](https://render.com/docs/deploys)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [SQLAlchemy PostgreSQL driver documentation](https://docs.sqlalchemy.org/en/21/dialects/postgresql.html)

Provider pricing and plan eligibility are intentionally not quoted; verify them before provisioning.

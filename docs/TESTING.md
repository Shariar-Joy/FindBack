# Testing guide

Use only fictional data and a local test email sink. The checked-in tests do not need production credentials.

## Backend

Install `backend[test]`, then run `python -m pytest -q` from `backend`. Without `TEST_DATABASE_URL`, tests use in-memory SQLite with foreign keys enabled for fast logic checks. With a PostgreSQL URL, each test creates a random isolated schema and removes only that schema afterward. Existing application tables are untouched. Use the PostgreSQL mode to verify enums, locking, upserts, constraints and driver behavior.

Tests exercise public role injection rejection, registration, login errors, HTTP-only cookies, CSRF/origin rejection, logout, ownership, pending-case privacy, publication allowlists, approval, resolution/hiding, rejection/corrections, sighting privacy/review, duplicate subscription rejection, logical notification uniqueness, image signature/metadata handling, password reset expiry/single use, queue failure/backoff/lease recovery, demo suppression, administration and shared rate limits.

The current FastAPI/Starlette TestClient emits an upstream httpx deprecation warning. It does not fail the suite. Deployment uses Uvicorn, not TestClient.

## Frontend

From `frontend`, run `npm test` for Vitest/Testing Library, and `npm run build` for strict TypeScript plus the production bundle. Tests cover accessible navigation, registration validation, permission UI, debounced server filters, loading states and actionable API errors.

## Cloud regression tests and repository checks

`backend/tests/test_cloud_adapters.py` uses botocore stubs and a mocked SMTP
transport to verify missing-object behavior, response stream cleanup, certificate
verification, and unsafe production configuration rejection. No real AWS service
or external SMTP delivery is performed by these tests.

After staging changes, run `python scripts/check_repository.py` from the root.
It checks tracked files for generated/private paths, common credential formats,
invalid JSON, and broken local Markdown links. This focused check complements code
review and GitHub secret scanning; it is not an exhaustive secret detector.

The GitHub Actions [CI workflow](../.github/workflows/ci.yml) runs the PostgreSQL
suite (including isolated migration upgrade/downgrade/drift), frontend checks,
the browser harness, and both container builds on Linux. No production secrets
are needed. Browser failure reports are retained for seven days.

## End-to-end and visual checks

Start Docker PostgreSQL/Mailpit, then from the root run `python scripts/run_e2e.py`. The harness generates test credentials in process memory, applies migrations and seeds a random temporary schema, starts its own API/worker/frontend on 8010/5174, runs Playwright, and cleans up its services/schema. It reads no developer demo password. It never sends mail outside localhost:1025. A compatible browser must already be installed or explicitly installed by the operator.

The workflow registers and logs in distinct reporter/subscriber users, subscribes to a district, submits through all four form steps, asserts a public 404 while pending, approves through a separate moderator session, checks public privacy, submits/reviews a private sighting, waits for SENT and confirms Mailpit capture, then resolves and asserts public removal.

Public page tests cover directory search, Leaflet markers/clustering, alerts, information/auth pages and runtime errors. Homepage widths 320/390/768/1440, private dashboard/report widths 320/768, reviewer width 390 and admin width 320 are checked for horizontal overflow. A separate admin browser check loads real analytics, accounts, audit history, notification jobs and health. Screenshots and traces live in ignored `frontend/test-results` and `frontend/playwright-report`. Desktop/mobile screenshots were inspected during implementation. This is a targeted responsive smoke check, not an exhaustive device/accessibility certification.

## Performance and reliability

`python scripts/load_smoke.py` measures actual HTTP case-list requests against the running local API. `k6 run scripts/load.js` is the longer optional scenario (requires k6).

`python scripts/notification_experiment.py` uses a separate FastAPI TestClient harness, local PostgreSQL and Mailpit. It compares synchronous mail delivery with a transactionally queued response followed by worker draining. It injects one delivery failure and an expired worker lease, then verifies recovery. Timing results explicitly identify their local/in-process scope. See PERFORMANCE.md and the raw JSON outputs.

## External verification still required

Cloud account deployment, private S3 provider compatibility, real SMTP TLS delivery, production proxy/client-IP behavior, managed backup restoration and independent security review require the actual target services. A passing local suite is not evidence that these external tasks occurred.

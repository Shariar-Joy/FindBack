# Measured local performance

Measured on 18 October 2026 in the development environment: Windows host, Docker PostgreSQL 17.11 and Mailpit, Python 3.14, FastAPI and SQLAlchemy. These are local educational measurements; they are not cloud or real-world response-time claims. Raw outputs are in `load-results.json` and `notification-experiment-results.json`. Re-running scripts overwrites these outputs.

## Public directory HTTP smoke load

The running application served 100 actual HTTP requests to `GET /api/v1/cases?page_size=12` with 10 concurrent clients and three public fictional cases.

| Metric | Recorded value |
| --- | ---: |
| Median request latency | 74.01 ms |
| 95th percentile | 298.66 ms |
| Failed requests | 0 / 100 |
| Error rate | 0% |
| Total elapsed | 1.03 seconds |

This small, warm, read-only run does not establish maximum capacity, cold-start behavior, slow-client performance, write contention or production SLOs. The supplied k6 scenario has not been run in this environment.

## Synchronous versus asynchronous notification processing

A separate temporary FastAPI harness used the same PostgreSQL queue worker and SMTP adapter as the application. Ten request samples per mode sent five fictional messages per request into **local Mailpit**. API timings include in-process TestClient dispatch and actual DB/SMTP operations. The asynchronous mode measured the committed response first, then drained the worker serially and measured completion. It did not add a synchronous endpoint to the real application.

| Metric | Synchronous | Asynchronous queue |
| --- | ---: | ---: |
| Median API latency | 61.22 ms | 7.44 ms |
| API p95 | 101.80 ms | 35.03 ms |
| Median notification completion | 61.22 ms | 163.24 ms |
| Notification completion p95 | 101.80 ms | 227.22 ms |
| Failed requests | 0 / 10 | 0 / 10 |

The queue returned sooner while complete delivery took longer in this controlled run. That is consistent with moving delivery work out of the request and adding per-job persistence; it is not a guarantee that every asynchronous metric will be faster. Ten samples are insufficient for a stable tail-latency estimate, and real networks/providers may behave differently.

## Retry and recovery observation

One synthetic SMTP failure was injected. The worker scheduled approximately **9.99 seconds** of initial backoff. The experiment then advanced that job's due time and deliberately abandoned a leased claim to simulate a worker crash. It expired the lease and restarted processing. The job reached **SENT** on attempt **3** (including the abandoned claim), with **28.16 ms** measured recovery processing and no remaining due work.

The time jump makes this a deterministic recovery experiment; it does not measure an actual 120-second outage. Backend tests also check retry/lease behavior. Neither test proves exactly-once SMTP delivery across a provider-acceptance/database-commit crash. Stable logical job keys and Message-ID values do not eliminate that final uncertainty.

## Reproduce

With local PostgreSQL and Mailpit running, execute from the repository root:

```powershell
.\.venv\Scripts\python.exe scripts\notification_experiment.py
# Start the application API for the separate HTTP load measurement.
.\.venv\Scripts\python.exe scripts\load_smoke.py --requests 100 --concurrency 10
```

The notification experiment creates/drops only its own random database schema, forces SMTP to localhost:1025, and uses example.com synthetic recipients. Do not adapt it to send real community alerts. Preserve raw results and workload details when comparing environments.

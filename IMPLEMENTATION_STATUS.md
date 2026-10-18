# Implementation status

Reviewed: **18 October 2026 (Asia/Dhaka)**.

FindBack implements the core application workflows from the supplied project plan.
This file distinguishes verified local behavior from work requiring an AWS account.

## Implemented

- Responsive React/TypeScript frontend: directory, district filters, case details,
  maps, reporting, private dashboard, subscriptions, moderation, and administration.
- FastAPI authentication with Argon2id, HTTP-only sessions, CSRF protection,
  database rate limits, password recovery, account settings, and role/ownership checks.
- Private case submission/correction, moderated publication, duplicate/correction
  decisions, concerns/removal requests, resolution, and audit records.
- Private sightings and sanitized image attachments with restricted retrieval.
- PostgreSQL schema/migration, transactional outbox, independent leased worker,
  retry/backoff, delivery history, and demo-mail suppression.
- Local/private S3 storage and authenticated, certificate-verified SMTP TLS.
- Development Compose and AWS production Compose with frontend Nginx proxy,
  RDS/S3/SES configuration examples, IAM policy, and release instructions.
- GitHub CI, dependency updates, issue/PR templates, contribution/security policies,
  changelog, repository hygiene checks, and all-rights-reserved copyright notice.

## Verification during this review

| Check | Result |
| --- | --- |
| Initial backend SQLite checks | 19 passed; PostgreSQL migration test skipped as expected |
| Updated PostgreSQL integration and cloud regression suite | 32 passed |
| Migration upgrade/downgrade/upgrade and schema drift | Passed within the PostgreSQL suite |
| Frontend tests | 5 passed |
| Strict TypeScript and production build | Passed |
| Playwright workflows, responsive pages, and administration | 3 passed (28.6 seconds) |
| API Python 3.12 and frontend production containers | Built successfully |
| Nginx configuration validation | Passed |
| Container proxy smoke checks | SPA deep links, API readiness/directory, headers, cache policy and private-route 401 passed |
| AWS Compose configuration | Validated without resolving production secrets |
| Backend dependency consistency | `pip check` passed |
| npm dependency audit after Vitest update | 0 reported vulnerabilities |

The updated cloud regression tests use mocked/stubbed transports. They do not
prove live AWS or SMTP integration. PostgreSQL tests use disposable schemas, and
the browser harness uses generated credentials and fictional data.

The TestClient has an upstream httpx deprecation notice, and Vite reports upstream
Zod annotation notices plus an approximately 674 KB initial JS chunk. These do
not fail checks. Local performance measurements in `docs/PERFORMANCE.md` are
historical experiments, not cloud benchmarks.

## Remaining external acceptance work

1. Provision AWS compute/ALB/HTTPS, private RDS and S3, IAM roles, SES sender and SMTP credentials.
2. Verify actual-domain cookies/CSRF/client IPs, S3 upload/read/delete/privacy,
   SES TLS delivery, and worker failure/recovery on the target host.
3. Configure CloudWatch/alerts, operator support, retention, managed backups,
   and a recorded restore drill using a separate database.
4. Run the longer staging load test and an independent accessibility/security review
   before accepting real personal information.

No live AWS deployment, real cloud adapter check, cloud restore drill, or
independent production certification is claimed. The EC2 template is a single-host
demonstration architecture; higher availability requires a separate rollout design.

## Deliberate limits

- PostgreSQL is the durable notification queue. SQS/Redis are not implemented or required.
- All 64 Bangladesh districts are supported in the directory. Twelve coarse map
  centroids are curated; other districts remain directory-only.
- Resolved and hidden cases/media are private by default.
- SMTP is at-least-once. A provider-acceptance/database-commit crash can duplicate
  a message despite logical uniqueness and stable Message-ID.
- Application removal restricts/deletes current objects; operators must separately
  align S3 version retention and backup deletion with their policy.
- Public source visibility does not grant reuse rights; see [LICENSE](LICENSE).

See [project review](docs/PROJECT_REVIEW.md), [AWS deployment](docs/AWS_DEPLOYMENT.md),
and [testing](docs/TESTING.md) for details.

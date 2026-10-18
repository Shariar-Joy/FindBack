# Project review and repository preparation

Review date: **18 October 2026 (Asia/Dhaka)**.

## Findings and fixes

The existing application already implemented the main reporting, moderation,
private sighting, subscription, notification, and administration workflows. Its
main repository/deployment gaps were the absence of Git history, CI and contribution
metadata, AWS-specific configuration, and publication hygiene for generated files.

| Finding | Action |
| --- | --- |
| No Git repository or CI | Initialized `main`; added PostgreSQL/migration, frontend, browser and container CI jobs |
| Deployment guide focused on other providers | Added EC2/ALB/RDS/S3/SES instructions and production Compose/environment/IAM examples |
| No frontend production container | Added a multi-stage Nginx image with SPA fallback and same-origin API proxy |
| SMTP STARTTLS did not explicitly verify the server certificate | Added the system trust context and certificate/hostname verification regression test |
| Missing S3 objects propagated SDK errors; response streams were not explicitly closed | Translate missing-object errors to image 404s and always close response streams; tested with botocore stubs |
| Environment typos could bypass production validation | Restricted environment/adapter values and strengthened HTTPS origin, mail and worker validation |
| npm audit reported three test-toolchain vulnerabilities | Updated Vitest to the patched compatible major; audit now reports zero; CI checks advisories |
| Local build/test files could clutter publication | Expanded ignore rules and added a tracked-file hygiene/link/JSON checker |
| Repository policies and metadata missing | Added README navigation/status, changelog, contribution/security guidance, issue/PR templates, Dependabot, editor settings and copyright notice |

## Files and cleanup decisions

- **Publish:** application source, lockfiles, migrations, tests, scripts, deployment
  templates, documentation, curated screenshots, measured experiment outputs, and
  the original project-plan PDF as the project specification.
- **Keep local and exclude from Git:** `.venv`, `node_modules`, `dist`, `.env` and
  production secrets, private media, runtime logs, temporary audit helpers, pytest
  caches, Vite caches, Playwright reports, traces, and TypeScript build metadata.
- Remove stale generated reports/caches where safe. Dependencies remain installed
  for local development. Do not delete source or data merely because it is unused
  by one deployment option; the alternative-provider templates remain documented.
- No credentials, production database dumps, or user-uploaded media belong in the
  repository. The environment files that are published are placeholder examples.

## Verification and practical limits

The updated PostgreSQL suite passes **32 tests**, frontend checks pass **5 tests**,
and **3 Playwright workflows** cover reporting through resolution, public/mobile
pages, and administration. Backend and frontend containers build, the Nginx
configuration validates, and a read-only container smoke check verifies SPA deep
links, API routing/readiness, security/cache headers, and private-route protection.

See [implementation status](../IMPLEMENTATION_STATUS.md) for the complete check
record and [testing](TESTING.md) for reproduction commands. Known non-failing
toolchain notices and the initial frontend bundle size remain documented.

## AWS readiness

**Deployable application/configuration; target-account acceptance still pending.**
The [AWS guide](AWS_DEPLOYMENT.md) provides the required topology, secrets, IAM,
RDS TLS, SES, build/migration/start commands, smoke workflow, monitoring, and backup
steps. Provisioning, external adapter validation, actual HTTPS behavior, monitoring,
and restoration require an AWS account and are not represented as completed.

## Publication settings

Target: `Shariar-Joy/FindBack`, **public**, default branch **main**.
The owner requested **all rights reserved**, so no permissive open-source license
is granted. Repository topics, dependency alerts, and private vulnerability
reporting are configured during publication where the account permits them.

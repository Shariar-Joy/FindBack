# API guide

Base path: `/api/v1`. Interactive local documentation: `http://127.0.0.1:8000/api/docs`; machine schema: `/api/openapi.json` and the checked-in `docs/openapi.json` snapshot.

## Authentication and errors

Register with `display_name`, `email`, a 12–128 character password containing uppercase/lowercase/digit, and `accept_terms: true`. Public registration always creates USER. Registration and forgotten-password responses do not disclose whether an account exists.

Login returns the authenticated profile and sets `findback_session` (HTTP-only, SameSite=Lax) and `findback_csrf`. Send cookies on subsequent requests. For every authenticated POST/PATCH/PUT/DELETE, send the readable CSRF cookie value as `X-CSRF-Token`. An exact origin allowlist also protects browser writes. Sessions are random opaque tokens; only hashes are stored in PostgreSQL.

Errors use `{"error":{"message":"...","fields":[{"field":"...","message":"..."}]}}`. `fields` is included for validation errors. Typical status codes: 401 sign-in required, 403 permission/CSRF/origin denied, 404 unavailable or non-owned resource, 409 conflicting state, 422 invalid input, 429 throttled, 503 data service unavailable. Public 404 responses do not reveal pending case existence.

## Resources

| Method | Endpoint | Permission / behavior |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | Public; shared database rate limits |
| POST | `/auth/logout` | Authenticated; revoke current session |
| POST | `/auth/forgot-password`, `/auth/reset-password` | Public; expiring single-use tokens; reset revokes all sessions |
| GET | `/auth/me` | Current account profile |
| GET | `/cases`, `/cases/{case_code}` | Approved public fields only |
| POST | `/cases` | Signed-in reporter; PENDING/PRIVATE result |
| GET | `/me/cases`, `/me/cases/{case_code}` | Owner's private reports only |
| PUT | `/me/cases/{case_code}` | Owner corrections for pending/rejected cases; returns to pending |
| POST | `/me/cases/{case_code}/removal` | Owner's private removal concern |
| POST | `/cases/{case_code}/sightings` | Public or signed-in; private good-faith sighting |
| GET | `/me/sightings` | Only the authenticated submitter's observations |
| POST | `/cases/{case_code}/abuse` | Public concern; private moderation queue |
| POST | `/cases/{case_code}/photo` | Owner; multipart `file`, pending/rejected only |
| GET | `/cases/{case_code}/photo` | Case and photograph must both be approved/public |
| GET, DELETE | `/private/cases/{case_code}/photo` | Owner or reviewer; authorized media removal |
| POST | `/sightings/{id}/photo` | Signed-in sighting owner; pending only |
| GET | `/private/sightings/{id}/photo` | Sighting owner or reviewer |
| GET, POST | `/me/subscriptions` | Own subscriptions; valid region code required |
| DELETE | `/me/subscriptions/{id}` | Own subscription only |
| GET | `/me/notifications` | Own notification history; hidden case details omitted |
| PATCH | `/me/profile` | Current password required to change account details/preferences |
| POST | `/me/password` | Current password required; revoke all sessions |
| DELETE | `/me/account` | Current password required; deactivation, not hard deletion |
| GET | `/regions`, `/alerts` | Public area catalog and approved active alerts |
| GET | `/dashboard/public-stats` | Actual database counts; response time is null when unmeasured |
| GET | `/dashboard/user-stats` | Own report/sighting counts |
| GET | `/moderator/stats`, `/moderator/cases`, `/moderator/cases/{case_code}` | MODERATOR/ADMIN authorized submissions |
| PATCH | `/moderator/cases/{case_code}/review` | APPROVED / REJECTED / CORRECTIONS / DUPLICATE; audited |
| PATCH | `/moderator/cases/{case_code}/resolve` | Approved case only; hide and resolve; reason required |
| PATCH | `/moderator/cases/{case_code}/visibility` | Hide/restore approved active case; reason required |
| GET, PATCH | `/moderator/sightings`, `/moderator/sightings/{id}/review` | Private reviewer queue and notes |
| GET, PATCH | `/moderator/abuse`, `/moderator/abuse/{id}` | Concerns/removal review and optional case hiding |
| GET, PATCH | `/admin/users`, `/admin/users/{id}` | ADMIN; audited access changes, sessions revoked |
| GET | `/admin/analytics`, `/admin/audit-logs` | ADMIN; actual grouped records and audit history |
| GET, POST | `/admin/notification-jobs`, `/admin/notification-jobs/{id}/retry` | ADMIN; failed deliveries only can be retried |
| GET | `/admin/health` | ADMIN; database status and adapter configuration |
| GET | `/health`, `/ready` | Liveness and migrated database readiness, also available at root |

## Filtering and pagination

`GET /cases` accepts `q` (name/reference), `division`, `district`, `city` (city/general area), `status`, `date_from`, `date_to`, `sort=newest|oldest`, `page` and `page_size` (1–100; default 12). Filters run in SQL. Unpublished records are excluded before filtering and counting. Dates use ISO 8601.

Paginated responses contain `items`, `total`, `page`, `page_size`. Personal/reviewer/admin queues use fixed 20-item pages; audit uses 30; alerts use 12. Subscriptions are a single user's area list. The map paginates at 100 and clearly labels markers for the current page.

`CaseInput` requires person information, general last-seen fields, an offset-aware past `last_seen_at`, a safe private contact, and `acknowledgement: true`. Raw coordinates and public visibility are rejected as unknown fields. The full request fields and limits appear in OpenAPI.

Sightings require an offset-aware past `observed_at`, `location_description`, `notes` and `consent: true`. Anonymous text sightings are supported. Sign-in is required for attaching an image and tracking the observation in My Sightings.

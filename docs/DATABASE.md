# Database relationships

All record IDs are random UUIDs. Public case references contain 64 random bits and are unrelated to primary keys. PostgreSQL enums constrain role, lifecycle, publication visibility, sighting review status and notification status. Case lifecycle and visibility are independent. A check constraint prevents pending/rejected public records.

```mermaid
erDiagram
    USERS ||--o{ MISSING_PERSON_CASES : submits
    USERS ||--o{ SESSIONS : authenticates
    USERS ||--o{ PASSWORD_RESETS : requests
    USERS ||--o{ SIGHTINGS : submits
    USERS ||--o{ AREA_SUBSCRIPTIONS : follows
    USERS ||--o{ NOTIFICATION_JOBS : receives
    USERS ||--o{ AUDIT_LOGS : performs
    MISSING_PERSON_CASES ||--|| CASE_PRIVATE_CONTACTS : protects
    MISSING_PERSON_CASES ||--o{ CASE_MEDIA : owns
    MISSING_PERSON_CASES ||--o{ SIGHTINGS : receives
    MISSING_PERSON_CASES ||--o{ NOTIFICATION_JOBS : triggers
    MISSING_PERSON_CASES ||--o{ ABUSE_REPORTS : receives
    MISSING_PERSON_CASES ||--o{ AUDIT_LOGS : records
    USERS {
      uuid id PK
      string email UK
      string password_hash
      enum role
      boolean is_active
    }
    MISSING_PERSON_CASES {
      uuid id PK
      string case_code UK
      uuid submitted_by FK
      enum status
      enum publication_visibility
      string public_area_code
    }
    AREA_SUBSCRIPTIONS {
      uuid id PK
      uuid user_id FK
      string area_code
    }
    NOTIFICATION_JOBS {
      uuid id PK
      uuid case_id FK
      uuid user_id FK
      string channel
      enum status
      integer attempts
      datetime available_at
      datetime lease_until
    }
```

`case_private_contacts.case_id` is unique. Subscriptions have a composite user/area unique constraint; notification jobs have a composite case/user/channel unique constraint. Images are object keys, not binary columns. `email_outbox` independently handles reset links and generic private review notifications. `rate_buckets` uses atomic upserts and hashed network buckets.

Foreign keys restrict deleting a case's reporter, cascade dependent case data, cascade user sessions/subscriptions/jobs, and preserve audit records with nullable actor/case references. Accounts are deactivated instead of hard-deleted through the UI. Public access never depends on cascade behavior.

Initial migration: `backend/alembic/versions/9c699a783d3d_initial_schema.py`. Run from `backend`: `python -m alembic upgrade head`. Inspect a proposed migration before deployment. `python -m alembic check` detects metadata drift. Never use `create_all` in production startup; it is reserved for isolated automated test schemas.

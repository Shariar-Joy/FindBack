"""Relational records. Public serializers never expose these models directly."""
import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now() -> datetime:
    return datetime.now(timezone.utc)


def uid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Role(str, enum.Enum):
    USER = "USER"
    MODERATOR = "MODERATOR"
    ADMIN = "ADMIN"


class Status(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RESOLVED = "RESOLVED"


class Visibility(str, enum.Enum):
    PRIVATE = "PRIVATE"
    PUBLIC = "PUBLIC"


class SightingStatus(str, enum.Enum):
    PENDING = "PENDING"
    REVIEWED = "REVIEWED"
    DISMISSED = "DISMISSED"


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SENT = "SENT"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Record:
    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class User(Record, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.USER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class SessionToken(Record, Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class PasswordReset(Record, Base):
    __tablename__ = "password_resets"
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class Case(Record, Base):
    __tablename__ = "missing_person_cases"
    __table_args__ = (
        CheckConstraint("approximate_age IS NULL OR (approximate_age >= 0 AND approximate_age <= 120)"),
        CheckConstraint("publication_visibility != 'PUBLIC' OR status IN ('APPROVED', 'RESOLVED')"),
        Index("ix_cases_public_area", "publication_visibility", "status", "district"),
    )
    case_code: Mapped[str] = mapped_column(String(24), unique=True)
    submitted_by: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    person_name: Mapped[str] = mapped_column(String(120))
    approximate_age: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text)
    clothing_description: Mapped[str] = mapped_column(Text)
    additional_context: Mapped[str] = mapped_column(Text, default="")
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    country_code: Mapped[str] = mapped_column(String(2), default="BD")
    division: Mapped[str] = mapped_column(String(80), index=True)
    district: Mapped[str] = mapped_column(String(80), index=True)
    city: Mapped[str] = mapped_column(String(100))
    area_name: Mapped[str] = mapped_column(String(160))
    # Area code is selected by a moderator. Coordinates are derived from a trusted catalog.
    public_area_code: Mapped[str | None] = mapped_column(String(80))
    photo_key: Mapped[str | None] = mapped_column(String(250))
    status: Mapped[Status] = mapped_column(Enum(Status), default=Status.PENDING, index=True)
    publication_visibility: Mapped[Visibility] = mapped_column(Enum(Visibility), default=Visibility.PRIVATE)
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    moderation_notes: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class PrivateContact(Record, Base):
    __tablename__ = "case_private_contacts"
    case_id: Mapped[str] = mapped_column(ForeignKey("missing_person_cases.id", ondelete="CASCADE"), unique=True)
    relationship: Mapped[str] = mapped_column(String(120))
    private_contact_method: Mapped[str] = mapped_column(String(30))
    private_contact_value: Mapped[str] = mapped_column(String(254))


class Sighting(Record, Base):
    __tablename__ = "sightings"
    case_id: Mapped[str] = mapped_column(ForeignKey("missing_person_cases.id", ondelete="CASCADE"), index=True)
    submitted_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location_description: Mapped[str] = mapped_column(String(500))
    notes: Mapped[str] = mapped_column(Text)
    safe_contact: Mapped[str] = mapped_column(String(254), default="")
    attachment_key: Mapped[str | None] = mapped_column(String(250))
    status: Mapped[SightingStatus] = mapped_column(Enum(SightingStatus), default=SightingStatus.PENDING, index=True)
    review_notes: Mapped[str] = mapped_column(Text, default="")
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class Subscription(Record, Base):
    __tablename__ = "area_subscriptions"
    __table_args__ = (UniqueConstraint("user_id", "area_code"),)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    area_code: Mapped[str] = mapped_column(String(80))


class NotificationJob(Record, Base):
    """Transactional outbox and durable queue, claimed with SKIP LOCKED + leases."""
    __tablename__ = "notification_jobs"
    __table_args__ = (UniqueConstraint("case_id", "user_id", "channel"),)
    case_id: Mapped[str] = mapped_column(ForeignKey("missing_person_cases.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(20), default="email")
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    claim_token: Mapped[str | None] = mapped_column(String(64))


class EmailOutbox(Record, Base):
    __tablename__ = "email_outbox"
    recipient: Mapped[str] = mapped_column(String(254))
    subject: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    claim_token: Mapped[str | None] = mapped_column(String(64))
    last_error: Mapped[str | None] = mapped_column(Text)


class AuditLog(Record, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    case_id: Mapped[str | None] = mapped_column(ForeignKey("missing_person_cases.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(80))
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class AbuseReport(Record, Base):
    __tablename__ = "abuse_reports"
    reported_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    case_id: Mapped[str] = mapped_column(ForeignKey("missing_person_cases.id", ondelete="CASCADE"), index=True)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    decision: Mapped[str] = mapped_column(Text, default="")
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class CaseMedia(Record, Base):
    __tablename__ = "case_media"
    case_id: Mapped[str] = mapped_column(ForeignKey("missing_person_cases.id", ondelete="CASCADE"), index=True)
    object_key: Mapped[str] = mapped_column(String(250), unique=True)
    media_type: Mapped[str] = mapped_column(String(30), default="image/jpeg")
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility), default=Visibility.PRIVATE)


class RateBucket(Base):
    __tablename__ = "rate_buckets"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

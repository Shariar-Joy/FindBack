import secrets
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import AuditLog, Case, CaseMedia, NotificationJob, Role, Status, Subscription, User, Visibility
from app.regions import AREAS
from app.schemas import PublicCase


def public_query():
    return select(Case).where(Case.status.in_([Status.APPROVED, Status.RESOLVED]), Case.publication_visibility == Visibility.PUBLIC)


def get_public(db: Session, code: str) -> Case:
    case = db.scalar(public_query().where(Case.case_code == code))
    if not case:
        raise HTTPException(404, "Case not found or not available for publication.")
    return case


def get_case(db: Session, code: str) -> Case:
    case = db.scalar(select(Case).where(Case.case_code == code))
    if not case:
        raise HTTPException(404, "Case not found.")
    return case


def owned_case(db: Session, code: str, user: User) -> Case:
    case = db.scalar(select(Case).where(Case.case_code == code, Case.submitted_by == user.id))
    if not case:
        raise HTTPException(404, "Case not found.")
    return case


def code() -> str:
    return "FB-" + secrets.token_hex(8).upper()


def public_case(db: Session, case: Case) -> dict:
    media = db.scalar(select(CaseMedia).where(CaseMedia.case_id == case.id, CaseMedia.object_key == case.photo_key, CaseMedia.visibility == Visibility.PUBLIC)) if case.photo_key else None
    return PublicCase(
        **{key: getattr(case, key) for key in ["case_code", "person_name", "approximate_age", "description", "clothing_description", "additional_context", "country_code", "division", "district", "city", "area_name", "status", "publication_visibility", "is_demo"]},
        last_seen_date=case.last_seen_at.date().isoformat(), public_location=AREAS.get(case.public_area_code, {}).get("centroid"),
        photo_url=f"/api/v1/cases/{case.case_code}/photo" if media else None, published_at=case.reviewed_at,
    ).model_dump()


def private_case(db: Session, case: Case, reviewer: bool = False) -> dict:
    from app.models import PrivateContact
    result = public_case(db, case)
    contact = db.scalar(select(PrivateContact).where(PrivateContact.case_id == case.id))
    result.update(created_at=case.created_at, last_seen_at=case.last_seen_at, rejection_reason=case.rejection_reason,
                  photo_url=f"/api/v1/private/cases/{case.case_code}/photo" if case.photo_key else None,
                  contact={"relationship": contact.relationship, "method": contact.private_contact_method, "value": contact.private_contact_value} if contact else None)
    if reviewer:
        reporter = db.get(User, case.submitted_by)
        result.update(reporter={"display_name": reporter.display_name, "email": reporter.email}, moderation_notes=case.moderation_notes)
    return result


def audit(db: Session, user: User, action: str, case: Case | None = None, **details):
    db.add(AuditLog(actor_id=user.id, action=action, case_id=case.id if case else None, details=details))


def enqueue_alerts(db: Session, case: Case):
    """Called inside the approval transaction. Unique key makes reapproval idempotent."""
    users = db.scalars(select(User).join(Subscription, Subscription.user_id == User.id).where(
        Subscription.area_code == "BD:" + case.district, User.is_active.is_(True), User.email_alerts.is_(True))).all()
    for user in users:
        if not db.scalar(select(NotificationJob.id).where(NotificationJob.case_id == case.id, NotificationJob.user_id == user.id, NotificationJob.channel == "email")):
            db.add(NotificationJob(case_id=case.id, user_id=user.id, channel="email"))

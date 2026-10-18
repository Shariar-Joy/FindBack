from datetime import date, datetime, time, timezone
from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from app.core.security import Current, DB, OptionalUser, limit
from app.core.config import get_settings
from app.models import AbuseReport, Case, PrivateContact, Sighting, Status
from app.schemas import CaseInput, Reason, SightingInput
from app.services.cases import code, get_public, owned_case, private_case, public_case, public_query

router = APIRouter(tags=["Cases and sightings"])


@router.get("/cases")
def list_cases(db: DB, q: str = Query("", max_length=120), division: str = "", district: str = "", city: str = "", status: Status | None = None,
               date_from: date | None = None, date_to: date | None = None, sort: str = Query("newest", pattern="^(newest|oldest)$"),
               page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=100)):
    query = public_query()
    if q:
        safe = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(or_(Case.person_name.ilike(f"%{safe}%", escape="\\"), Case.case_code.ilike(f"%{safe}%", escape="\\")))
    if division:
        query = query.where(Case.division == division)
    if district:
        query = query.where(Case.district == district)
    if city:
        query = query.where(or_(Case.city.ilike(f"%{city}%"), Case.area_name.ilike(f"%{city}%")))
    if status:
        query = query.where(Case.status == status)
    if date_from:
        query = query.where(Case.last_seen_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        query = query.where(Case.last_seen_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    query = query.order_by(Case.created_at.desc() if sort == "newest" else Case.created_at.asc(), Case.case_code)
    return {"items": [public_case(db, c) for c in db.scalars(query.offset((page - 1) * page_size).limit(page_size))], "total": total, "page": page, "page_size": page_size}


@router.get("/cases/{case_code}")
def detail(case_code: str, db: DB):
    return public_case(db, get_public(db, case_code))


@router.post("/cases", status_code=201)
def create_case(data: CaseInput, request: Request, db: DB, user: Current):
    limit(request, db, "case", 10)
    values = data.model_dump(exclude={"relationship", "private_contact_method", "private_contact_value", "acknowledgement"})
    case = Case(**values, case_code=code(), submitted_by=user.id, is_demo=get_settings().environment != "production")
    db.add(case)
    db.flush()
    db.add(PrivateContact(case_id=case.id, relationship=data.relationship, private_contact_method=data.private_contact_method, private_contact_value=data.private_contact_value))
    return {"case_code": case.case_code, "status": case.status, "message": "Your report is private and awaiting publication review."}


@router.get("/me/cases")
def my_cases(db: DB, user: Current, page: int = Query(1, ge=1)):
    query = select(Case).where(Case.submitted_by == user.id)
    return {"items": [private_case(db, c) for c in db.scalars(query.order_by(Case.created_at.desc()).offset((page - 1) * 20).limit(20))], "total": db.scalar(select(func.count()).select_from(query.subquery())), "page": page, "page_size": 20}


@router.get("/me/cases/{case_code}")
def own_case(case_code: str, db: DB, user: Current):
    return private_case(db, owned_case(db, case_code, user))


@router.put("/me/cases/{case_code}")
def correct_case(case_code: str, data: CaseInput, db: DB, user: Current):
    case = owned_case(db, case_code, user)
    if case.status not in {Status.PENDING, Status.REJECTED}:
        raise HTTPException(409, "Request reviewer assistance to edit a published or resolved report.")
    for key, value in data.model_dump(exclude={"relationship", "private_contact_method", "private_contact_value", "acknowledgement"}).items():
        setattr(case, key, value)
    contact = db.scalar(select(PrivateContact).where(PrivateContact.case_id == case.id))
    contact.relationship, contact.private_contact_method, contact.private_contact_value = data.relationship, data.private_contact_method, data.private_contact_value
    case.status, case.rejection_reason = Status.PENDING, None
    return {"message": "Corrections submitted privately for review."}


@router.post("/cases/{case_code}/sightings", status_code=201)
def sighting(case_code: str, data: SightingInput, request: Request, db: DB, user: OptionalUser):
    limit(request, db, "sighting", 10)
    case = get_public(db, case_code)
    if case.status != Status.APPROVED:
        raise HTTPException(409, "This case is no longer accepting sightings.")
    record = Sighting(case_id=case.id, submitted_by=user.id if user else None, **data.model_dump(exclude={"consent"}))
    db.add(record)
    db.flush()
    # Generic reviewer emails contain no sighting details and are queued in this transaction.
    from app.models import EmailOutbox, Role, User
    if not case.is_demo or get_settings().allow_demo_email:
        for reviewer in db.scalars(select(User).where(User.role.in_([Role.MODERATOR, Role.ADMIN]), User.is_active.is_(True), User.email_alerts.is_(True))):
            db.add(EmailOutbox(recipient=reviewer.email, subject="FindBack: private sighting awaiting review",
                              body=f"A private sighting is awaiting authorized review for {case.case_code}.\n{get_settings().frontend_url}/moderator?tab=sightings"))
    return {"id": record.id, "status": record.status, "message": "Your sighting has been sent privately to authorized reviewers."}


def sighting_data(db: DB, s: Sighting, reviewer=False):
    case = db.get(Case, s.case_id)
    result = {"id": s.id, "case_code": case.case_code, "observed_at": s.observed_at, "location_description": s.location_description,
              "notes": s.notes, "status": s.status, "created_at": s.created_at, "attachment_url": f"/api/v1/private/sightings/{s.id}/photo" if s.attachment_key else None}
    if reviewer:
        result.update(safe_contact=s.safe_contact, review_notes=s.review_notes)
    return result


@router.get("/me/sightings")
def my_sightings(db: DB, user: Current, page: int = Query(1, ge=1)):
    query = select(Sighting).where(Sighting.submitted_by == user.id)
    return {"items": [sighting_data(db, s) for s in db.scalars(query.order_by(Sighting.created_at.desc()).offset((page-1)*20).limit(20))], "total": db.scalar(select(func.count()).select_from(query.subquery())), "page": page, "page_size": 20}


@router.post("/cases/{case_code}/abuse", status_code=201)
def report_abuse(case_code: str, data: Reason, request: Request, db: DB, user: OptionalUser):
    limit(request, db, "abuse", 10)
    case = get_public(db, case_code)
    db.add(AbuseReport(case_id=case.id, reported_by=user.id if user else None, reason=data.reason))
    return {"message": "Your concern was submitted privately for review."}


@router.post("/me/cases/{case_code}/removal", status_code=201)
def request_removal(case_code: str, data: Reason, db: DB, user: Current):
    case = owned_case(db, case_code, user)
    db.add(AbuseReport(case_id=case.id, reported_by=user.id, reason="REMOVAL REQUEST: " + data.reason))
    return {"message": "Removal request sent to reviewers."}

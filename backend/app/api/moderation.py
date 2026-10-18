from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from app.api.cases import sighting_data
from app.core.security import DB, Moderator
from app.models import AbuseReport, Case, CaseMedia, Sighting, SightingStatus, Status, Visibility, now
from app.regions import AREAS
from app.schemas import AbuseReview, Reason, Review, SightingReview, VisibilityInput
from app.services.cases import audit, enqueue_alerts, get_case, private_case

router = APIRouter(prefix="/moderator", tags=["Moderation"])


@router.get("/stats")
def stats(db: DB, user: Moderator):
    counts = dict(db.execute(select(Case.status, func.count()).group_by(Case.status)).all())
    return {"pending": counts.get(Status.PENDING, 0), "approved": counts.get(Status.APPROVED, 0), "rejected": counts.get(Status.REJECTED, 0),
            "sightings": db.scalar(select(func.count()).select_from(Sighting).where(Sighting.status == SightingStatus.PENDING)),
            "abuse": db.scalar(select(func.count()).select_from(AbuseReport).where(AbuseReport.status == "PENDING"))}


@router.get("/cases")
def cases(db: DB, user: Moderator, status: Status | None = None, page: int = Query(1, ge=1)):
    query = select(Case)
    if status:
        query = query.where(Case.status == status)
    return {"items": [private_case(db, c, True) for c in db.scalars(query.order_by(Case.created_at.desc()).offset((page-1)*20).limit(20))], "total": db.scalar(select(func.count()).select_from(query.subquery())), "page": page, "page_size": 20}


@router.get("/cases/{case_code}")
def case_detail(case_code: str, db: DB, user: Moderator):
    case = get_case(db, case_code)
    # Similar-name/district candidates aid manual duplicate review; never label verified.
    candidates = db.scalars(select(Case).where(Case.id != case.id, Case.district == case.district, Case.person_name.ilike(f"%{case.person_name[:8]}%")).limit(5)).all()
    return {**private_case(db, case, True), "possible_duplicates": [{"case_code": c.case_code, "person_name": c.person_name, "status": c.status} for c in candidates]}


@router.patch("/cases/{case_code}/review")
def review(case_code: str, data: Review, db: DB, user: Moderator):
    case = db.scalar(select(Case).where(Case.case_code == case_code).with_for_update())
    if not case:
        raise HTTPException(404, "Case not found.")
    if case.status not in {Status.PENDING, Status.REJECTED}:
        raise HTTPException(409, "Only pending or rejected reports can be reviewed.")
    if data.decision != "APPROVED" and len(data.reason) < 5:
        raise HTTPException(422, "Provide a reason for this decision.")
    if data.public_area_code and (data.public_area_code not in AREAS or AREAS[data.public_area_code]["name"] != case.district):
        raise HTTPException(422, "Choose the case district as the public map area.")
    case.reviewed_by, case.reviewed_at = user.id, now()
    case.moderation_notes = data.reason
    if data.decision == "APPROVED":
        for key in ["person_name", "description", "clothing_description", "area_name", "additional_context"]:
            if getattr(data, key) is not None:
                setattr(case, key, getattr(data, key))
        case.status, case.publication_visibility = Status.APPROVED, Visibility.PUBLIC
        case.public_area_code, case.rejection_reason = data.public_area_code, None
        for media in db.scalars(select(CaseMedia).where(CaseMedia.case_id == case.id)):
            media.visibility = Visibility.PUBLIC if data.approve_photo and media.object_key == case.photo_key else Visibility.PRIVATE
        enqueue_alerts(db, case)
    else:
        case.status = Status.PENDING if data.decision == "CORRECTIONS" else Status.REJECTED
        case.publication_visibility, case.rejection_reason = Visibility.PRIVATE, data.reason
    audit(db, user, "CASE_" + data.decision, case, reason=data.reason, public_area_code=data.public_area_code, approve_photo=data.approve_photo)
    return {"message": "Publication decision saved.", "status": case.status}


@router.patch("/cases/{case_code}/resolve")
def resolve(case_code: str, data: Reason, db: DB, user: Moderator):
    case = db.scalar(select(Case).where(Case.case_code == case_code).with_for_update())
    if not case or case.status != Status.APPROVED:
        raise HTTPException(409, "Only approved cases can be resolved.")
    case.status, case.resolved_at, case.publication_visibility = Status.RESOLVED, now(), Visibility.PRIVATE
    for media in db.scalars(select(CaseMedia).where(CaseMedia.case_id == case.id)):
        media.visibility = Visibility.PRIVATE
    audit(db, user, "CASE_RESOLVED", case, reason=data.reason)
    return {"message": "Case resolved and removed from public view."}


@router.patch("/cases/{case_code}/visibility")
def visibility(case_code: str, data: VisibilityInput, db: DB, user: Moderator):
    case = get_case(db, case_code)
    if data.visibility == Visibility.PUBLIC and case.status != Status.APPROVED:
        raise HTTPException(409, "Only approved active cases may be published. Resolved records remain private.")
    case.publication_visibility = data.visibility
    audit(db, user, "VISIBILITY_" + data.visibility.value, case, reason=data.reason)
    return {"message": "Publication visibility updated."}


@router.get("/sightings")
def sightings(db: DB, user: Moderator, status: SightingStatus | None = None, page: int = Query(1, ge=1)):
    query = select(Sighting)
    if status:
        query = query.where(Sighting.status == status)
    return {"items": [sighting_data(db, s, True) for s in db.scalars(query.order_by(Sighting.created_at.desc()).offset((page-1)*20).limit(20))], "total": db.scalar(select(func.count()).select_from(query.subquery())), "page": page, "page_size": 20}


@router.patch("/sightings/{sighting_id}/review")
def review_sighting(sighting_id: str, data: SightingReview, db: DB, user: Moderator):
    record = db.get(Sighting, sighting_id)
    if not record:
        raise HTTPException(404, "Sighting not found.")
    record.status, record.review_notes, record.reviewed_by = SightingStatus(data.status), data.notes, user.id
    audit(db, user, "SIGHTING_" + data.status, db.get(Case, record.case_id), sighting_id=record.id, reason=data.notes)
    return {"message": "Private sighting review saved."}


@router.get("/abuse")
def abuse(db: DB, user: Moderator, page: int = Query(1, ge=1)):
    query = select(AbuseReport).order_by(AbuseReport.created_at.desc())
    return {"items": [{"id": a.id, "case_code": db.get(Case, a.case_id).case_code, "reason": a.reason, "status": a.status, "decision": a.decision, "created_at": a.created_at}
                      for a in db.scalars(query.offset((page-1)*20).limit(20))], "total": db.scalar(select(func.count()).select_from(AbuseReport)), "page": page, "page_size": 20}


@router.patch("/abuse/{report_id}")
def review_abuse(report_id: str, data: AbuseReview, db: DB, user: Moderator):
    record = db.get(AbuseReport, report_id)
    if not record:
        raise HTTPException(404, "Concern not found.")
    record.status, record.decision, record.reviewed_by = "REVIEWED", data.decision, user.id
    case = db.get(Case, record.case_id)
    if data.hide_case:
        case.publication_visibility = Visibility.PRIVATE
    audit(db, user, "ABUSE_REVIEWED", case, reason=data.decision, hidden=data.hide_case)
    return {"message": "Review decision saved."}

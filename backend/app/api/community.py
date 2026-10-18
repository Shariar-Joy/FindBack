from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from app.core.security import Current, DB
from app.models import Case, NotificationJob, Sighting, Status, Subscription
from app.regions import AREAS, DIVISIONS
from app.schemas import SubscriptionInput
from app.services.cases import public_case, public_query

router = APIRouter(tags=["Community"])


@router.get("/regions")
def regions():
    return {"divisions": DIVISIONS, "areas": list(AREAS.values())}


@router.get("/alerts")
def alerts(db: DB, district: str = "", page: int = Query(1, ge=1)):
    query = public_query().where(Case.status == Status.APPROVED)
    if district:
        query = query.where(Case.district == district)
    return {"items": [public_case(db, c) for c in db.scalars(query.order_by(Case.reviewed_at.desc()).offset((page-1)*12).limit(12))], "total": db.scalar(select(func.count()).select_from(query.subquery())), "page": page, "page_size": 12}


@router.get("/me/subscriptions")
def subscriptions(db: DB, user: Current):
    return [{"id": s.id, "area_code": s.area_code, "area_name": AREAS[s.area_code]["name"], "created_at": s.created_at}
            for s in db.scalars(select(Subscription).where(Subscription.user_id == user.id).order_by(Subscription.created_at.desc()))]


@router.post("/me/subscriptions", status_code=201)
def subscribe(data: SubscriptionInput, db: DB, user: Current):
    if data.area_code not in AREAS:
        raise HTTPException(422, "Select a supported district.")
    record = Subscription(user_id=user.id, area_code=data.area_code)
    db.add(record)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You are already subscribed to this district.")
    return {"id": record.id, "area_code": record.area_code}


@router.delete("/me/subscriptions/{subscription_id}")
def unsubscribe(subscription_id: str, db: DB, user: Current):
    record = db.scalar(select(Subscription).where(Subscription.id == subscription_id, Subscription.user_id == user.id))
    if not record:
        raise HTTPException(404, "Subscription not found.")
    db.delete(record)
    return {"message": "Unsubscribed."}


@router.get("/me/notifications")
def notifications(db: DB, user: Current, page: int = Query(1, ge=1)):
    query = select(NotificationJob).where(NotificationJob.user_id == user.id)
    items = []
    for job in db.scalars(query.order_by(NotificationJob.created_at.desc()).offset((page-1)*20).limit(20)):
        case = db.get(Case, job.case_id)
        public = case.publication_visibility.value == "PUBLIC" and case.status in {Status.APPROVED, Status.RESOLVED}
        items.append({"id": job.id, "case_code": case.case_code if public else None, "area": case.district if public else "Unavailable case", "status": job.status, "created_at": job.created_at, "sent_at": job.sent_at})
    return {"items": items, "total": db.scalar(select(func.count()).select_from(query.subquery())), "page": page, "page_size": 20}


@router.get("/dashboard/public-stats")
def public_stats(db: DB):
    active = db.scalar(select(func.count()).select_from(public_query().where(Case.status == Status.APPROVED).subquery()))
    # Found count uses actual resolved records. No outcome/recovery promise is inferred.
    resolved = db.scalar(select(func.count()).select_from(Case).where(Case.status == Status.RESOLVED))
    return {"active_cases": active, "people_found": resolved, "active_alerts": active, "average_response_hours": None}


@router.get("/dashboard/user-stats")
def user_stats(db: DB, user: Current):
    def count(status=None):
        query = select(func.count()).select_from(Case).where(Case.submitted_by == user.id)
        return db.scalar(query.where(Case.status == status) if status else query)
    return {"reports": count(), "pending": count(Status.PENDING), "approved": count(Status.APPROVED), "sightings": db.scalar(select(func.count()).select_from(Sighting).where(Sighting.submitted_by == user.id))}

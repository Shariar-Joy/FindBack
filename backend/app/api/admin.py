from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select, text
from app.core.security import Admin, DB, revoke_sessions
from app.models import AuditLog, Case, JobStatus, NotificationJob, Role, Sighting, User, now
from app.schemas import AdminUser
from app.services.cases import audit

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/users")
def users(db: DB, user: Admin, page: int = Query(1, ge=1), q: str = Query("", max_length=100)):
    query = select(User).where(User.email.ilike(f"%{q}%"))
    return {"items": [{"id": u.id, "email": u.email, "display_name": u.display_name, "role": u.role, "is_active": u.is_active, "created_at": u.created_at}
                      for u in db.scalars(query.order_by(User.created_at.desc()).offset((page-1)*20).limit(20))], "total": db.scalar(select(func.count()).select_from(query.subquery())), "page": page, "page_size": 20}


@router.patch("/users/{user_id}")
def edit_user(user_id: str, data: AdminUser, db: DB, user: Admin):
    # Serialize changes to admin membership to protect the last active administrator.
    admins = db.scalars(select(User).where(User.role == Role.ADMIN, User.is_active.is_(True)).with_for_update()).all()
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Account not found.")
    if target.id == user.id and (data.role != Role.ADMIN or not data.is_active):
        raise HTTPException(409, "Ask another administrator to change your own access.")
    if target in admins and len(admins) <= 1 and (data.role != Role.ADMIN or not data.is_active):
        raise HTTPException(409, "The last active administrator must be retained.")
    target.role, target.is_active = data.role, data.is_active
    revoke_sessions(db, target.id)
    audit(db, user, "USER_ACCESS_CHANGED", target_id=target.id, role=data.role.value, active=data.is_active, reason=data.reason)
    return {"message": "Account access updated and sessions revoked."}


@router.get("/audit-logs")
def logs(db: DB, user: Admin, page: int = Query(1, ge=1)):
    return {"items": [{"id": a.id, "actor": db.get(User, a.actor_id).display_name if a.actor_id and db.get(User, a.actor_id) else "Removed account", "action": a.action,
                       "case_code": db.get(Case, a.case_id).case_code if a.case_id else None, "details": a.details, "created_at": a.created_at}
                      for a in db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).offset((page-1)*30).limit(30))],
            "total": db.scalar(select(func.count()).select_from(AuditLog)), "page": page, "page_size": 30}


@router.get("/analytics")
def analytics(db: DB, user: Admin):
    def groups(column, model):
        return [{"name": str(key.value if hasattr(key, "value") else key), "count": count} for key, count in db.execute(select(column, func.count()).select_from(model).group_by(column)).all()]
    return {"users": db.scalar(select(func.count()).select_from(User)), "cases": db.scalar(select(func.count()).select_from(Case)),
            "by_status": groups(Case.status, Case), "by_district": groups(Case.district, Case), "submissions": groups(func.date(Case.created_at), Case),
            "sightings": groups(func.date(Sighting.created_at), Sighting), "notifications": groups(NotificationJob.status, NotificationJob)}


@router.get("/notification-jobs")
def jobs(db: DB, user: Admin, page: int = Query(1, ge=1)):
    return {"items": [{"id": j.id, "case_code": db.get(Case, j.case_id).case_code, "status": j.status, "attempts": j.attempts, "last_error": j.last_error, "created_at": j.created_at, "sent_at": j.sent_at}
                      for j in db.scalars(select(NotificationJob).order_by(NotificationJob.created_at.desc()).offset((page-1)*20).limit(20))],
            "total": db.scalar(select(func.count()).select_from(NotificationJob)), "page": page, "page_size": 20}


@router.post("/notification-jobs/{job_id}/retry")
def retry(job_id: str, db: DB, user: Admin):
    job = db.scalar(select(NotificationJob).where(NotificationJob.id == job_id).with_for_update())
    if not job or job.status != JobStatus.FAILED:
        raise HTTPException(409, "Only failed jobs can be retried.")
    job.status, job.attempts, job.available_at, job.last_error = JobStatus.PENDING, 0, now(), None
    audit(db, user, "NOTIFICATION_RETRY", db.get(Case, job.case_id), job_id=job.id)
    return {"message": "Retry queued."}


@router.get("/health")
def health(db: DB, user: Admin):
    from app.core.config import get_settings
    db.execute(text("SELECT 1"))
    settings = get_settings()
    return {"database": "connected", "queue": "postgresql-outbox", "pending_jobs": db.scalar(select(func.count()).select_from(NotificationJob).where(NotificationJob.status == JobStatus.PENDING)),
            "storage": settings.storage_backend, "email": settings.email_backend, "environment": settings.environment}

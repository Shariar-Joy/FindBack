from fastapi import APIRouter, HTTPException, Request, Response, UploadFile
from sqlalchemy import select
from app.core.security import Current, DB, limit
from app.models import Case, CaseMedia, Role, Sighting, Status, Visibility
from app.services.cases import audit, get_case, get_public, owned_case
from app.storage.adapters import MAX_IMAGE_BYTES, clean_image, storage

router = APIRouter(tags=["Media"])


def serve(key: str) -> Response:
    try:
        return Response(storage().get(key), media_type="image/jpeg", headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})
    except FileNotFoundError:
        raise HTTPException(404, "Image not found.")


@router.post("/cases/{case_code}/photo", status_code=201)
async def upload_case(case_code: str, file: UploadFile, request: Request, db: DB, user: Current):
    limit(request, db, "upload", 20)
    case = owned_case(db, case_code, user)
    if case.status not in {Status.PENDING, Status.REJECTED}:
        raise HTTPException(409, "Images on published cases require a new review.")
    data = clean_image(await file.read(MAX_IMAGE_BYTES + 1))
    adapter = storage()
    key = adapter.put(data)
    old_key = case.photo_key
    case.photo_key = key
    db.add(CaseMedia(case_id=case.id, object_key=key, visibility=Visibility.PRIVATE))
    try:
        db.commit()
    except Exception:
        adapter.delete(key)
        raise
    if old_key:
        adapter.delete(old_key)
    return {"message": "Image uploaded privately for review."}


@router.get("/cases/{case_code}/photo")
def public_photo(case_code: str, db: DB):
    case = get_public(db, case_code)
    media = db.scalar(select(CaseMedia).where(CaseMedia.case_id == case.id, CaseMedia.object_key == case.photo_key, CaseMedia.visibility == Visibility.PUBLIC))
    if not media:
        raise HTTPException(404, "Image not available.")
    return serve(media.object_key)


@router.get("/private/cases/{case_code}/photo")
def private_photo(case_code: str, db: DB, user: Current):
    case = get_case(db, case_code) if user.role in {Role.MODERATOR, Role.ADMIN} else owned_case(db, case_code, user)
    if not case.photo_key:
        raise HTTPException(404, "No image.")
    return serve(case.photo_key)


@router.delete("/private/cases/{case_code}/photo")
def remove_photo(case_code: str, db: DB, user: Current):
    case = get_case(db, case_code) if user.role in {Role.MODERATOR, Role.ADMIN} else owned_case(db, case_code, user)
    key = case.photo_key
    if key:
        case.photo_key = None
        for media in db.scalars(select(CaseMedia).where(CaseMedia.case_id == case.id, CaseMedia.object_key == key)):
            media.visibility = Visibility.PRIVATE
        audit(db, user, "MEDIA_REMOVED", case)
        db.commit()
        storage().delete(key)
    return {"message": "Photograph removed."}


@router.post("/sightings/{sighting_id}/photo", status_code=201)
async def sighting_photo(sighting_id: str, file: UploadFile, request: Request, db: DB, user: Current):
    limit(request, db, "upload", 20)
    record = db.scalar(select(Sighting).where(Sighting.id == sighting_id, Sighting.submitted_by == user.id))
    if not record or record.status.value != "PENDING":
        raise HTTPException(404, "Sighting not available for attachments.")
    adapter = storage()
    key = adapter.put(clean_image(await file.read(MAX_IMAGE_BYTES + 1)))
    old = record.attachment_key
    record.attachment_key = key
    try:
        db.commit()
    except Exception:
        adapter.delete(key)
        raise
    if old:
        adapter.delete(old)
    return {"message": "Supporting image saved privately."}


@router.get("/private/sightings/{sighting_id}/photo")
def private_sighting_photo(sighting_id: str, db: DB, user: Current):
    query = select(Sighting).where(Sighting.id == sighting_id)
    if user.role not in {Role.MODERATOR, Role.ADMIN}:
        query = query.where(Sighting.submitted_by == user.id)
    sighting = db.scalar(query)
    if not sighting or not sighting.attachment_key:
        raise HTTPException(404, "Image not found.")
    return serve(sighting.attachment_key)

import secrets
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.core.config import get_settings
from app.core.security import Current, DB, DUMMY_HASH, clear_cookies, create_session, digest, hasher, limit, revoke_sessions, verify
from app.models import EmailOutbox, PasswordReset, Role, SessionToken, User, now
from app.schemas import ChangePassword, Deactivate, Forgot, Login, Profile, Register, Reset

router = APIRouter(tags=["Authentication"])


def user_data(user: User):
    return {"id": user.id, "email": user.email, "display_name": user.display_name, "role": user.role, "email_alerts": user.email_alerts, "is_demo": user.is_demo}


@router.post("/auth/register", status_code=201)
def register(data: Register, request: Request, db: DB):
    limit(request, db, "register", 10)
    user = User(email=str(data.email).lower(), display_name=data.display_name, password_hash=hasher.hash(data.password))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        # Same successful response for an existing address prevents account discovery.
    return {"message": "Registration processed. You can sign in, or reset your password if you already have an account."}


@router.post("/auth/login")
def login(data: Login, request: Request, response: Response, db: DB):
    limit(request, db, "login", 20, 900)
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    valid = verify(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid or not user.is_active:
        raise HTTPException(401, "Unable to sign in with those credentials.")
    # Rotate existing browser session.
    old = request.cookies.get("findback_session")
    if old:
        from sqlalchemy import delete
        db.execute(delete(SessionToken).where(SessionToken.token_hash == digest(old)))
    create_session(db, response, user, data.remember)
    return user_data(user)


@router.post("/auth/logout")
def logout(request: Request, response: Response, db: DB, user: Current):
    token = db.scalar(select(SessionToken).where(SessionToken.token_hash == digest(request.cookies.get("findback_session", ""))))
    if token:
        db.delete(token)
    clear_cookies(response)
    return {"message": "Signed out."}


@router.get("/auth/me")
def me(user: Current):
    return user_data(user)


@router.post("/auth/forgot-password")
def forgot(data: Forgot, request: Request, db: DB):
    limit(request, db, "forgot", 5, 900)
    user = db.scalar(select(User).where(User.email == str(data.email).lower(), User.is_active.is_(True)))
    # Perform the same random/hash work for both paths. Token is never returned or logged.
    token = secrets.token_urlsafe(48)
    hashed = digest(token)
    if user:
        db.add(PasswordReset(user_id=user.id, token_hash=hashed, expires_at=now() + timedelta(minutes=30)))
        url = f"{get_settings().frontend_url}/reset-password#token={token}"
        db.add(EmailOutbox(recipient=user.email, subject="Reset your FindBack password", body=f"Use this private link within 30 minutes:\n{url}\nIf you did not request this, ignore this email."))
    return {"message": "If that address is registered, a reset link will be emailed shortly."}


@router.post("/auth/reset-password")
def reset(data: Reset, request: Request, response: Response, db: DB):
    limit(request, db, "reset", 10, 900)
    record = db.scalar(select(PasswordReset).where(PasswordReset.token_hash == digest(data.token), PasswordReset.used.is_(False), PasswordReset.expires_at > now()).with_for_update())
    if not record:
        raise HTTPException(400, "This link is invalid or expired. Request a new reset link.")
    user = db.get(User, record.user_id)
    if not user.is_active:
        raise HTTPException(400, "This link is invalid or expired. Request a new reset link.")
    user.password_hash = hasher.hash(data.password)
    # Invalidate every reset token and session for the account.
    for item in db.scalars(select(PasswordReset).where(PasswordReset.user_id == user.id)):
        item.used = True
    revoke_sessions(db, user.id)
    clear_cookies(response)
    return {"message": "Password updated. Please sign in again."}


@router.patch("/me/profile")
def profile(data: Profile, request: Request, db: DB, user: Current):
    limit(request, db, "profile", 20, 900)
    if not verify(data.current_password, user.password_hash):
        raise HTTPException(400, "Unable to update settings. Check your password.")
    user.display_name, user.email, user.email_alerts = data.display_name, str(data.email).lower(), data.email_alerts
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "Unable to update settings with those details.")
    return user_data(user)


@router.post("/me/password")
def password(data: ChangePassword, request: Request, response: Response, db: DB, user: Current):
    limit(request, db, "password-change", 10, 900)
    if not verify(data.current_password, user.password_hash):
        raise HTTPException(400, "Unable to change password. Check your current password.")
    user.password_hash = hasher.hash(data.password)
    revoke_sessions(db, user.id)
    clear_cookies(response)
    return {"message": "Password changed. Sign in again."}


@router.delete("/me/account")
def deactivate(data: Deactivate, request: Request, response: Response, db: DB, user: Current):
    limit(request, db, "account", 10, 900)
    if not verify(data.current_password, user.password_hash):
        raise HTTPException(400, "Unable to deactivate account.")
    if user.role == Role.ADMIN:
        active_admins = db.scalars(select(User).where(User.role == Role.ADMIN, User.is_active.is_(True)).with_for_update()).all()
        if len(active_admins) <= 1:
            raise HTTPException(409, "Create another active administrator before deactivating your account.")
    user.is_active = False
    revoke_sessions(db, user.id)
    clear_cookies(response)
    return {"message": "Account deactivated. Existing reports are retained for review and audit."}

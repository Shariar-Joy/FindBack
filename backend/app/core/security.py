import hashlib
import hmac
import secrets
import time
from datetime import timedelta
from typing import Annotated
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.session import get_db
from app.models import RateBucket, Role, SessionToken, User, now

hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(24))
DB = Annotated[Session, Depends(get_db, scope="function")]


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def verify(password: str, hashed: str) -> bool:
    try:
        return hasher.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def limit(request: Request, db: Session, category: str, maximum: int, seconds: int = 3600):
    """Atomic DB buckets shared across processes; never trust forwarded IP headers."""
    if not get_settings().rate_limit_enabled:
        return
    bucket = int(time.time()) // seconds
    key = digest(f"{category}:{request.client.host if request.client else 'unknown'}:{bucket}")
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    stmt = insert(RateBucket).values(key=key, count=1, expires_at=now() + timedelta(seconds=seconds))
    count = db.execute(stmt.on_conflict_do_update(index_elements=["key"], set_={"count": RateBucket.count + 1}).returning(RateBucket.count)).scalar_one()
    db.commit()  # Count unsuccessful attempts too. Call before any application mutations.
    if count > maximum:
        raise HTTPException(429, "Too many requests. Please try again later.", headers={"Retry-After": str(seconds)})


def optional_user(request: Request, db: DB) -> User | None:
    token = request.cookies.get("findback_session")
    if not token:
        return None
    session = db.scalar(select(SessionToken).where(SessionToken.token_hash == digest(token), SessionToken.expires_at > now()))
    if not session:
        return None
    user = db.get(User, session.user_id)
    if not user or not user.is_active:
        return None
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        csrf = request.headers.get("X-CSRF-Token", "")
        if not csrf or not hmac.compare_digest(digest(csrf), session.csrf_hash):
            raise HTTPException(403, "Security token expired. Refresh and try again.")
    return user


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise HTTPException(401, "Please sign in to continue.")
    return user


Current = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]


def moderator(user: Current) -> User:
    if user.role not in {Role.MODERATOR, Role.ADMIN}:
        raise HTTPException(403, "Reviewer access required.")
    return user


def admin(user: Current) -> User:
    if user.role != Role.ADMIN:
        raise HTTPException(403, "Administrator access required.")
    return user


Moderator = Annotated[User, Depends(moderator)]
Admin = Annotated[User, Depends(admin)]


def create_session(db: Session, response: Response, user: User, remember: bool = False):
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    seconds = (30 if remember else 1) * 86400
    db.add(SessionToken(token_hash=digest(token), csrf_hash=digest(csrf), user_id=user.id, expires_at=now() + timedelta(seconds=seconds)))
    response.set_cookie("findback_session", token, httponly=True, secure=get_settings().cookie_secure, samesite="lax", max_age=seconds, path="/")
    response.set_cookie("findback_csrf", csrf, httponly=False, secure=get_settings().cookie_secure, samesite="lax", max_age=seconds, path="/")


def revoke_sessions(db: Session, user_id: str):
    db.execute(delete(SessionToken).where(SessionToken.user_id == user_id))


def clear_cookies(response: Response):
    for key in ["findback_session", "findback_csrf"]:
        response.delete_cookie(key, path="/", secure=get_settings().cookie_secure, samesite="lax")

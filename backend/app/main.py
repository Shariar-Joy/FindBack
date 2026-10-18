import logging
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import DataError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.api import admin, auth, cases, community, media, moderation
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.body_limit import BodyLimitMiddleware
from app.db.session import SessionLocal

settings = get_settings()


@asynccontextmanager
async def lifespan(app):
    settings.validate_production()
    configure_logging()
    yield


app = FastAPI(title="FindBack API", version="1.0.0", description="Private reporting and moderated community alerts. Publication approval does not imply official verification.", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "X-CSRF-Token"])
app.add_middleware(BodyLimitMiddleware)


@app.middleware("http")
async def protect(request: Request, call_next):
    request_id = uuid.uuid4().hex
    started = time.perf_counter()
    origin = request.headers.get("origin")
    if request.method not in {"GET", "HEAD", "OPTIONS"} and origin and origin not in settings.origins:
        return JSONResponse({"error": {"message": "Request origin is not allowed.", "request_id": request_id}}, status_code=403)
    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.headers.get("sec-fetch-site") == "cross-site":
        return JSONResponse({"error": {"message": "Cross-site write blocked.", "request_id": request_id}}, status_code=403)
    try:
        content_length = int(request.headers.get("content-length", "0") or "0")
    except ValueError:
        return JSONResponse({"error": {"message": "Invalid request length."}}, status_code=400)
    if content_length > 6 * 1024 * 1024:
        return JSONResponse({"error": {"message": "Request body too large."}}, status_code=413)
    response = await call_next(request)
    response.headers.update({"X-Request-ID": request_id, "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Cache-Control": "no-store"})
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    logging.getLogger("findback.api").info("request", extra={"request_id": request_id, "method": request.method, "status": response.status_code, "duration_ms": round((time.perf_counter()-started)*1000, 2)})
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error(request, exc):
    return JSONResponse({"error": {"message": exc.detail}}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    fields = [{"field": ".".join(str(v) for v in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
    return JSONResponse({"error": {"message": "Please check the submitted information.", "fields": fields}}, status_code=422)


@app.exception_handler(DataError)
async def bad_identifier(request, exc):
    return JSONResponse({"error": {"message": "Invalid identifier or input."}}, status_code=422)


@app.exception_handler(OperationalError)
async def unavailable(request, exc):
    return JSONResponse({"error": {"message": "The data service is unavailable. Please try again shortly."}}, status_code=503)


@app.exception_handler(Exception)
async def unexpected(request, exc):
    logging.getLogger("findback.api").error("unhandled_" + type(exc).__name__)
    return JSONResponse({"error": {"message": "An unexpected error occurred. Please try again."}}, status_code=500)


@app.get("/api/v1/health", tags=["System"])
@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "findback"}


@app.get("/api/v1/ready", tags=["System"])
@app.get("/ready", tags=["System"])
def ready():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
            db.execute(text("SELECT version_num FROM alembic_version"))
            db.execute(text("SELECT id FROM users LIMIT 1"))
    except Exception:
        raise HTTPException(503, "Database unavailable or migrations not applied.")
    return {"status": "ready", "database": "connected"}


for router in [auth.router, cases.router, community.router, moderation.router, admin.router, media.router]:
    app.include_router(router, prefix="/api/v1")

"""PostgreSQL outbox worker. One or more workers can claim independent leased jobs."""
import argparse
import logging
import secrets
import signal
import smtplib
import ssl
import time
from datetime import timedelta
from email.message import EmailMessage
from sqlalchemy import and_, delete, or_, select, update
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Case, EmailOutbox, JobStatus, NotificationJob, PasswordReset, RateBucket, SessionToken, Status, Subscription, User, Visibility, now

logger = logging.getLogger("findback.worker")


def send_email(to: str, subject: str, body: str, message_id: str):
    settings = get_settings()
    if settings.email_backend == "log" and settings.environment != "production":
        # Do not log recipients, private links or the message body.
        logger.info("email_captured", extra={"event_id": message_id})
        return
    if settings.email_backend != "smtp":
        raise RuntimeError("Email backend is not configured")
    message = EmailMessage()
    message["From"], message["To"], message["Subject"] = settings.email_from, to, subject
    message["Message-ID"] = f"<{message_id}@findback.local>"
    message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20, local_hostname="findback.local") as smtp:
        if settings.smtp_tls:
            smtp.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


def claim(model):
    settings = get_settings()
    with SessionLocal.begin() as db:
        job = db.scalar(select(model).where(or_(
            and_(model.status == JobStatus.PENDING, model.available_at <= now()),
            and_(model.status == JobStatus.PROCESSING, model.lease_until < now()),
        )).order_by(model.created_at).with_for_update(skip_locked=True).limit(1))
        if not job:
            return None
        if job.attempts >= settings.worker_max_attempts:
            job.status = JobStatus.FAILED
            return None
        job.status, job.claim_token = JobStatus.PROCESSING, secrets.token_hex(24)
        job.attempts += 1
        job.lease_until = now() + timedelta(seconds=settings.worker_lease_seconds)
        db.flush()
        return job.id, job.claim_token


def process_one(model=NotificationJob) -> bool:
    claimed = claim(model)
    if not claimed:
        return False
    job_id, token = claimed
    outcome, error = JobStatus.SENT, None
    try:
        with SessionLocal() as db:
            job = db.get(model, job_id)
            if model is NotificationJob:
                case, user = db.get(Case, job.case_id), db.get(User, job.user_id)
                subscribed = db.scalar(select(Subscription.id).where(Subscription.user_id == user.id, Subscription.area_code == "BD:" + case.district))
                if not user.is_active or not user.email_alerts or not subscribed or case.status != Status.APPROVED or case.publication_visibility != Visibility.PUBLIC:
                    outcome = JobStatus.CANCELLED
                elif (case.is_demo or user.is_demo) and not get_settings().allow_demo_email:
                    outcome = JobStatus.CANCELLED
                else:
                    send_email(user.email, f"FindBack community alert · {case.district}",
                               f"A case has been approved for publication in {case.district}.\nReference: {case.case_code}\n{get_settings().frontend_url}/cases/{case.case_code}\nPublication approval is not official verification. Do not approach or share private locations.\nManage subscriptions: {get_settings().frontend_url}/dashboard?tab=subscriptions", job.id)
            else:
                send_email(job.recipient, job.subject, job.body, job.id)
    except Exception as exc:
        # Error class only: SMTP errors can contain addresses and provider credentials.
        outcome, error = JobStatus.PENDING, type(exc).__name__
    with SessionLocal.begin() as db:
        job = db.scalar(select(model).where(model.id == job_id, model.claim_token == token).with_for_update())
        if not job:
            return True
        job.last_error, job.lease_until, job.claim_token = error, None, None
        if error:
            job.status = JobStatus.FAILED if job.attempts >= get_settings().worker_max_attempts else JobStatus.PENDING
            job.available_at = now() + timedelta(seconds=min(3600, 2 ** job.attempts * 5))
        else:
            job.status = outcome
            if model is NotificationJob and outcome == JobStatus.SENT:
                job.sent_at = now()
            elif model is EmailOutbox:
                job.body = ""  # Reset links are no longer needed after delivery.
        logger.info("job_processed", extra={"event_id": job_id, "job_status": job.status.value, "attempts": job.attempts})
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Drain currently due jobs then exit")
    args = parser.parse_args()
    from app.core.logging import configure_logging
    configure_logging()
    get_settings().validate_production()
    running = True

    def stop(*_):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    with SessionLocal.begin() as db:
        db.execute(delete(RateBucket).where(RateBucket.expires_at < now()))
        db.execute(delete(SessionToken).where(SessionToken.expires_at < now()))
        db.execute(delete(PasswordReset).where(PasswordReset.expires_at < now()))
    while running:
        try:
            worked = process_one(NotificationJob)
            worked = process_one(EmailOutbox) or worked
            if not worked:
                if args.once:
                    break
                time.sleep(get_settings().worker_poll_seconds)
        except Exception:
            logger.error("worker_iteration_failed")
            if args.once:
                raise
            time.sleep(5)


if __name__ == "__main__":
    main()

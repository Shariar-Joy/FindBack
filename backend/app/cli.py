"""Explicit bootstrap and development-only synthetic fixtures."""
import argparse
import os
from datetime import timedelta
from sqlalchemy import select
from app.core.config import get_settings
from app.core.security import hasher
from app.db.session import SessionLocal
from app.models import Case, NotificationJob, PrivateContact, Role, Sighting, Status, Subscription, User, Visibility, now
from app.schemas import strong_password
from app.services.cases import code


def bootstrap():
    email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "")
    from pydantic import EmailStr, TypeAdapter
    if not email or not password:
        raise SystemExit("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in the environment.")
    TypeAdapter(EmailStr).validate_python(email)
    strong_password(password)
    with SessionLocal.begin() as db:
        if db.scalar(select(User).where(User.role == Role.ADMIN)):
            raise SystemExit("An administrator already exists. Use audited role management instead.")
        if db.scalar(select(User).where(User.email == email)):
            raise SystemExit("That address already belongs to an account. Refusing implicit promotion.")
        user = User(email=email, password_hash=hasher.hash(password), display_name=os.environ.get("BOOTSTRAP_ADMIN_NAME", "FindBack Administrator"), role=Role.ADMIN)
        db.add(user)
        db.flush()
        from app.models import AuditLog
        db.add(AuditLog(actor_id=user.id, action="ADMIN_BOOTSTRAPPED", details={"source": "environment CLI"}))
    print("Initial administrator created. Password was not printed.")


def seed():
    if get_settings().environment != "development":
        raise SystemExit("Synthetic seeding is restricted to ENVIRONMENT=development.")
    password = os.environ.get("DEMO_PASSWORD", "")
    strong_password(password)
    with SessionLocal.begin() as db:
        if db.scalar(select(User).where(User.email == "admin@example.com")):
            print("Demo already seeded; no changes made.")
            return
        users = []
        for name, email, role in [("Demo Administrator", "admin@example.com", Role.ADMIN), ("Demo Moderator", "moderator@example.com", Role.MODERATOR), ("Demo Reporter", "reporter@example.com", Role.USER), ("Demo Subscriber", "subscriber@example.com", Role.USER)]:
            user = User(email=email, password_hash=hasher.hash(password), display_name=name, role=role, is_demo=True)
            db.add(user)
            users.append(user)
        db.flush()
        admin, mod, reporter, subscriber = users
        samples = [("Ayan Example", 24, "Dhaka", "Dhaka", "Dhanmondi", "Dhanmondi general area"), ("Mira Sample", 32, "Chattogram", "Chattogram", "Chattogram", "Panchlaish general area"), ("Rafi Fiction", 19, "Sylhet", "Sylhet", "Sylhet", "Zindabazar general area"), ("Nila Example", 45, "Dhaka", "Gazipur", "Gazipur", "Tongi general area"), ("Sami Sample", 27, "Rajshahi", "Rajshahi", "Rajshahi", "Boalia general area")]
        cases=[]
        for i, (name, age, division, district, city, area) in enumerate(samples):
            case = Case(case_code=code(), submitted_by=reporter.id, person_name=name, approximate_age=age,
                        description="Synthetic demonstration record. This fictional person is of medium build with short dark hair. No real person is represented.",
                        clothing_description="Demonstration details: a light blue shirt and dark trousers.", additional_context="This case exists only to demonstrate the FindBack project workflow.",
                        last_seen_at=now()-timedelta(days=i+1), division=division, district=district, city=city, area_name=area,
                        status=Status.APPROVED if i<3 else Status.PENDING, publication_visibility=Visibility.PUBLIC if i<3 else Visibility.PRIVATE,
                        public_area_code="BD:"+district if i<3 else None, reviewed_by=mod.id if i<3 else None,
                        reviewed_at=now()-timedelta(hours=i+1) if i<3 else None, is_demo=True)
            db.add(case)
            db.flush()
            db.add(PrivateContact(case_id=case.id, relationship="Fictional sibling", private_contact_method="email", private_contact_value="reporter@example.com"))
            cases.append(case)
        db.add_all([Subscription(user_id=subscriber.id, area_code="BD:Dhaka"),Subscription(user_id=reporter.id, area_code="BD:Sylhet")])
        db.add(Sighting(case_id=cases[0].id, submitted_by=subscriber.id, observed_at=now()-timedelta(hours=2), location_description="Fictional observation in a general public area", notes="Synthetic sighting for moderation demonstration. No real sighting is represented."))
        # Never delivered by default. Worker only allows demo delivery with an explicit local flag.
        db.add(NotificationJob(case_id=cases[0].id, user_id=subscriber.id))
    print("Seeded clearly fictional demo accounts/cases. All accounts use the supplied DEMO_PASSWORD.")


if __name__ == "__main__":
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["bootstrap-admin", "seed"])
    args = parser.parse_args()
    bootstrap() if args.command == "bootstrap-admin" else seed()

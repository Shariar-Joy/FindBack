import os
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.config import get_settings
from app.db.session import get_db
from app.main import app
from app.models import Base, Role, User
from app.core.security import hasher


@pytest.fixture
def environment(tmp_path, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "storage_path", tmp_path / "images")
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    monkeypatch.setattr(settings, "email_backend", "log")
    monkeypatch.setattr(settings, "allow_demo_email", True)
    url = os.environ.get("TEST_DATABASE_URL")
    if url:
        # Every test gets its own schema; no pre-existing tables/data are touched.
        admin_engine = create_engine(url)
        schema = "test_" + uuid.uuid4().hex
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        from sqlalchemy import event
        @event.listens_for(engine, "connect")
        def foreign_keys(conn, _):
            conn.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)

    def override():
        with factory() as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    app.dependency_overrides[get_db] = override
    from app.workers import notifications
    monkeypatch.setattr(notifications, "SessionLocal", factory)
    from app import main
    monkeypatch.setattr(main, "SessionLocal", factory)
    yield factory
    app.dependency_overrides.clear()
    engine.dispose()
    if url:
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin_engine.dispose()


@pytest.fixture
def client(environment):
    with TestClient(app) as client:
        yield client


@pytest.fixture
def accounts(environment):
    with environment.begin() as db:
        for name, role in [("user", Role.USER), ("other", Role.USER), ("moderator", Role.MODERATOR), ("admin", Role.ADMIN)]:
            db.add(User(email=f"{name}@example.com", display_name=name.title(), role=role, password_hash=hasher.hash("TestingPassword123")))


def login(client, email="user@example.com"):
    client.cookies.clear()
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "TestingPassword123"})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = client.cookies.get("findback_csrf")
    return response.json()


def case_payload():
    return {"person_name": "Fictional Test Person", "approximate_age": 28, "description": "Synthetic description for automated testing.",
            "clothing_description": "Blue shirt, dark trousers", "additional_context": "Fictional testing record", "last_seen_at": "2026-01-10T10:00:00+06:00",
            "division": "Dhaka", "district": "Dhaka", "city": "Dhaka", "area_name": "General district area", "relationship": "Sibling",
            "private_contact_method": "email", "private_contact_value": "secret@example.com", "acknowledgement": True}


def submit(client):
    response = client.post("/api/v1/cases", json=case_payload())
    assert response.status_code == 201, response.text
    return response.json()["case_code"]


def approve(client, code):
    response = client.patch(f"/api/v1/moderator/cases/{code}/review", json={"decision": "APPROVED", "public_area_code": "BD:Dhaka"})
    assert response.status_code == 200, response.text

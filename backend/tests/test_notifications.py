from sqlalchemy import select
from app.core.config import get_settings
from app.models import JobStatus, NotificationJob
from app.workers import notifications
from conftest import approve, login, submit


def test_demo_alerts_never_send_by_default(client, accounts, environment, monkeypatch):
    monkeypatch.setattr(get_settings(), "allow_demo_email", False)
    login(client)
    client.post('/api/v1/me/subscriptions', json={'area_code': 'BD:Dhaka'})
    code = submit(client)
    login(client, 'moderator@example.com')
    approve(client, code)
    delivered = []
    monkeypatch.setattr(notifications, 'send_email', lambda *args: delivered.append(args))
    notifications.process_one()
    with environment() as db:
        assert db.scalar(select(NotificationJob)).status == JobStatus.CANCELLED
    assert delivered == []

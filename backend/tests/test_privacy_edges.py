import io
from PIL import Image
from sqlalchemy import select
from app.models import AbuseReport, Role, User
from conftest import approve, login, submit


def test_approved_photo_is_revoked_by_hiding(client, accounts):
    login(client)
    code = submit(client)
    output = io.BytesIO()
    Image.new('RGB', (20, 20), 'blue').save(output, 'PNG')
    assert client.post(f'/api/v1/cases/{code}/photo', files={'file': ('test.png', output.getvalue(), 'image/png')}).status_code == 201
    login(client, 'moderator@example.com')
    assert client.patch(f'/api/v1/moderator/cases/{code}/review', json={'decision': 'APPROVED', 'approve_photo': True}).status_code == 200
    assert client.get(f'/api/v1/cases/{code}/photo').status_code == 200
    client.patch(f'/api/v1/moderator/cases/{code}/visibility', json={'visibility': 'PRIVATE', 'reason': 'Privacy concern requires review'})
    assert client.get(f'/api/v1/cases/{code}/photo').status_code == 404


def test_removal_concern_review_is_private_and_audited(client, accounts, environment):
    login(client)
    code = submit(client)
    assert client.post(f'/api/v1/me/cases/{code}/removal', json={'reason': 'Fictional reporter requests removal'}).status_code == 201
    login(client, 'other@example.com')
    assert client.post(f'/api/v1/me/cases/{code}/removal', json={'reason': 'Unauthorized request'}).status_code == 404
    login(client, 'moderator@example.com')
    record = client.get('/api/v1/moderator/abuse').json()['items'][0]
    assert client.patch(f"/api/v1/moderator/abuse/{record['id']}", json={'decision': 'Reviewed reporter request and kept private', 'hide_case': True}).status_code == 200
    assert client.get(f'/api/v1/cases/{code}').status_code == 404


def test_account_deactivation_revokes_sessions_and_protects_last_admin(client, accounts):
    login(client)
    assert client.request('DELETE', '/api/v1/me/account', json={'current_password': 'TestingPassword123'}).status_code == 200
    assert client.get('/api/v1/auth/me').status_code == 401
    assert client.post('/api/v1/auth/login', json={'email': 'user@example.com', 'password': 'TestingPassword123'}).status_code == 401
    login(client, 'admin@example.com')
    assert client.request('DELETE', '/api/v1/me/account', json={'current_password': 'TestingPassword123'}).status_code == 409


def test_streamed_request_size_is_bounded(client):
    response = client.post('/api/v1/auth/register', content=iter([b'x' * (1024 * 1024)] * 7), headers={'Content-Type': 'application/json'})
    assert response.status_code == 413

import io
from datetime import timedelta
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import func, select
from app.models import AuditLog, Case, EmailOutbox, JobStatus, NotificationJob, PasswordReset, Sighting, Status, User, now
from app.workers import notifications
from conftest import approve, case_payload, login, submit


def test_registration_never_accepts_role(client):
    data = {"display_name": "Test User", "email": "new@example.com", "password": "TestingPassword123", "accept_terms": True}
    assert client.post("/api/v1/auth/register", json={**data, "role": "ADMIN"}).status_code == 422
    assert client.post("/api/v1/auth/register", json=data).status_code == 201
    assert client.post("/api/v1/auth/register", json=data).status_code == 201
    response = client.post("/api/v1/auth/login", json={"email": data["email"], "password": data["password"]})
    assert response.json()["role"] == "USER"
    assert 'HttpOnly' in response.headers.get_list('set-cookie')[0]


def test_login_failure_and_authorization(client, accounts):
    for email in ["unknown@example.com", "user@example.com"]:
        response=client.post("/api/v1/auth/login", json={"email":email,"password":"wrong"})
        assert response.status_code == 401
        assert response.json()["error"]["message"] == "Unable to sign in with those credentials."
    assert client.get("/api/v1/me/cases").status_code == 401
    login(client)
    assert client.get("/api/v1/moderator/cases").status_code == 403
    assert client.get("/api/v1/admin/users").status_code == 403


def test_csrf_origin_logout(client, accounts):
    login(client)
    del client.headers["X-CSRF-Token"]
    assert client.post("/api/v1/cases", json=case_payload()).status_code == 403
    client.headers['X-CSRF-Token'] = client.cookies.get('findback_csrf')
    assert client.post("/api/v1/cases", json=case_payload(), headers={"Origin":"https://hostile.example"}).status_code == 403
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


def test_pending_privacy_and_ownership(client, accounts):
    login(client)
    code=submit(client)
    assert client.get(f"/api/v1/cases/{code}").status_code == 404
    assert client.get('/api/v1/cases').json()['total'] == 0
    assert client.get(f'/api/v1/me/cases/{code}').json()['contact']['value'] == 'secret@example.com'
    login(client, 'other@example.com')
    assert client.get(f'/api/v1/me/cases/{code}').status_code == 404
    assert client.get(f'/api/v1/private/cases/{code}/photo').status_code == 404


def test_approval_public_allowlist_filter_and_resolve(client, accounts, environment):
    login(client)
    code=submit(client)
    login(client,'moderator@example.com')
    approve(client,code)
    public=client.get(f'/api/v1/cases/{code}').json()
    for forbidden in ['id','submitted_by','contact','safe_contact','last_seen_at','moderation_notes','reviewed_by','photo_key','reporter','rejection_reason']:
        assert forbidden not in public
    assert public['public_location'] == [23.8,90.3]
    assert public['last_seen_date'] == '2026-01-10'
    assert client.get('/api/v1/cases',params={'q':code,'district':'Dhaka'}).json()['total'] == 1
    assert client.get('/api/v1/cases',params={'district':'Sylhet'}).json()['total'] == 0
    response=client.patch(f'/api/v1/moderator/cases/{code}/resolve',json={'reason':'Synthetic confirmation: person found safely'})
    assert response.status_code == 200
    assert client.get(f'/api/v1/cases/{code}').status_code == 404
    assert client.patch(f'/api/v1/moderator/cases/{code}/visibility',json={'visibility':'PUBLIC','reason':'Test retention'}).status_code == 409
    with environment() as db:
        assert db.scalar(select(func.count()).select_from(AuditLog)) == 2


def test_rejection_and_corrections(client, accounts):
    login(client); code=submit(client)
    login(client,'moderator@example.com')
    assert client.patch(f'/api/v1/moderator/cases/{code}/review',json={'decision':'REJECTED','reason':'Needs clearer information'}).status_code == 200
    assert client.get(f'/api/v1/cases/{code}').status_code == 404
    login(client)
    assert client.get(f'/api/v1/me/cases/{code}').json()['rejection_reason'] == 'Needs clearer information'
    assert client.put(f'/api/v1/me/cases/{code}',json=case_payload()).status_code == 200
    assert client.get(f'/api/v1/me/cases/{code}').json()['status'] == 'PENDING'


def test_sighting_private_and_review(client, accounts):
    login(client);code=submit(client)
    login(client,'moderator@example.com');approve(client,code)
    login(client)
    payload={'observed_at':'2026-01-11T10:00:00+06:00','location_description':'Private approximate area','notes':'Fictional possible observation for this test','consent':True}
    response=client.post(f'/api/v1/cases/{code}/sightings',json=payload)
    assert response.status_code == 201, response.text
    sid=response.json()['id']
    assert client.get('/api/v1/me/sightings').json()['total'] == 1
    assert 'sightings' not in client.get(f'/api/v1/cases/{code}').json()
    login(client,'other@example.com')
    assert client.get('/api/v1/me/sightings').json()['total'] == 0
    assert client.get('/api/v1/moderator/sightings').status_code == 403
    login(client,'moderator@example.com')
    assert client.patch(f'/api/v1/moderator/sightings/{sid}/review',json={'status':'REVIEWED','notes':'Privately reviewed'}).status_code == 200


def test_subscription_unique_owned_and_notification_idempotency(client, accounts, environment):
    login(client)
    response=client.post('/api/v1/me/subscriptions',json={'area_code':'BD:Dhaka'})
    sub_id=response.json()['id']
    assert client.post('/api/v1/me/subscriptions',json={'area_code':'BD:Dhaka'}).status_code == 409
    code=submit(client)
    login(client,'other@example.com')
    assert client.delete(f'/api/v1/me/subscriptions/{sub_id}').status_code == 404
    login(client,'moderator@example.com');approve(client,code)
    assert client.patch(f'/api/v1/moderator/cases/{code}/review',json={'decision':'APPROVED'}).status_code == 409
    from app.services.cases import enqueue_alerts
    with environment.begin() as db:
        case=db.scalar(select(Case).where(Case.case_code==code))
        enqueue_alerts(db,case)
    with environment() as db:
        assert db.scalar(select(func.count()).select_from(NotificationJob)) == 1


def test_images_signature_metadata_and_permissions(client, accounts):
    login(client);code=submit(client)
    assert client.post(f'/api/v1/cases/{code}/photo',files={'file':('fake.jpg',b'<script>bad</script>','image/jpeg')}).status_code == 422
    image=Image.new('RGB',(32,32),'red');buf=io.BytesIO();exif=Image.Exif();exif[270]='PRIVATE METADATA';image.save(buf,'JPEG',exif=exif)
    assert client.post(f'/api/v1/cases/{code}/photo',files={'file':('ok.jpg',buf.getvalue(),'image/jpeg')}).status_code == 201
    assert client.get(f'/api/v1/cases/{code}/photo').status_code == 404
    response=client.get(f'/api/v1/private/cases/{code}/photo')
    assert response.status_code == 200
    assert not Image.open(io.BytesIO(response.content)).getexif()
    login(client,'other@example.com')
    assert client.get(f'/api/v1/private/cases/{code}/photo').status_code == 404
    login(client,'moderator@example.com');approve(client,code)
    assert client.get(f'/api/v1/cases/{code}/photo').status_code == 404 # photo was not explicitly approved
    assert client.delete(f'/api/v1/private/cases/{code}/photo').status_code == 200


def test_password_reset_generic_expired_single_use(client, accounts, environment):
    messages=[]
    for address in ['user@example.com','none@example.com']:
        messages.append(client.post('/api/v1/auth/forgot-password',json={'email':address}).json())
    assert messages[0] == messages[1]
    with environment() as db:
        email=db.scalar(select(EmailOutbox))
        token=email.body.split('#token=')[1].split('\n')[0]
    response=client.post('/api/v1/auth/reset-password',json={'token':token,'password':'UpdatedPassword123'})
    assert response.status_code == 200
    assert client.post('/api/v1/auth/reset-password',json={'token':token,'password':'AnotherPassword123'}).status_code == 400
    client.post('/api/v1/auth/forgot-password',json={'email':'user@example.com'})
    with environment.begin() as db:
        reset=db.scalars(select(PasswordReset).where(PasswordReset.used.is_(False))).first()
        reset.expires_at=now()-timedelta(seconds=1)
        email=db.scalars(select(EmailOutbox).order_by(EmailOutbox.created_at.desc())).first()
        token=email.body.split('#token=')[1].split('\n')[0]
    assert client.post('/api/v1/auth/reset-password',json={'token':token,'password':'AnotherPassword123'}).status_code == 400


def test_worker_failure_backoff_and_restart_recovery(client, accounts, environment, monkeypatch):
    login(client);client.post('/api/v1/me/subscriptions',json={'area_code':'BD:Dhaka'});code=submit(client)
    login(client,'moderator@example.com');approve(client,code)
    def fail(*args):
        raise ConnectionError('Synthetic failure')
    monkeypatch.setattr(notifications,'send_email',fail)
    assert notifications.process_one()
    with environment.begin() as db:
        job=db.scalar(select(NotificationJob));assert job.attempts==1 and job.status==JobStatus.PENDING
        assert job.last_error=='ConnectionError'
        job.available_at=now()-timedelta(seconds=1)
    claimed=notifications.claim(NotificationJob) # Simulate crash after claiming, before sending.
    assert claimed
    with environment.begin() as db:
        job=db.get(NotificationJob,claimed[0]);job.lease_until=now()-timedelta(seconds=1)
    delivered=[]
    monkeypatch.setattr(notifications,'send_email',lambda *args:delivered.append(args))
    assert notifications.process_one()
    assert not notifications.process_one()
    with environment() as db:
        job=db.scalar(select(NotificationJob));assert job.status==JobStatus.SENT and job.attempts==3
    assert len(delivered)==1


def test_hide_cancels_notification_and_admin_roles(client, accounts, environment):
    login(client);client.post('/api/v1/me/subscriptions',json={'area_code':'BD:Dhaka'});code=submit(client)
    login(client,'moderator@example.com');approve(client,code)
    assert client.patch(f'/api/v1/moderator/cases/{code}/visibility',json={'visibility':'PRIVATE','reason':'Privacy review required'}).status_code==200
    notifications.process_one()
    with environment() as db:
        assert db.scalar(select(NotificationJob)).status==JobStatus.CANCELLED
    assert client.get('/api/v1/admin/analytics').status_code==403
    login(client,'admin@example.com')
    assert client.get('/api/v1/admin/analytics').json()['cases']==1
    with environment() as db:
        target=db.scalar(select(User).where(User.email=='user@example.com')).id
    assert client.patch(f'/api/v1/admin/users/{target}',json={'role':'MODERATOR','is_active':True,'reason':'Authorized test promotion'}).status_code==200


def test_shared_rate_limit_counts_failed_attempts(client, accounts, monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(),'rate_limit_enabled',True)
    for _ in range(20):
        assert client.post('/api/v1/auth/login',json={'email':'missing@example.com','password':'wrong'}).status_code==401
    assert client.post('/api/v1/auth/login',json={'email':'missing@example.com','password':'wrong'}).status_code==429


def test_validation_and_pagination(client, accounts):
    login(client)
    assert client.post('/api/v1/cases',json={**case_payload(),'district':'invalid'}).status_code==422
    assert client.post('/api/v1/cases',json={**case_payload(),'last_seen_at':'2099-01-01T00:00:00Z'}).status_code==422
    assert client.get('/api/v1/cases?page_size=999').status_code==422
    assert client.get('/api/v1/cases?page=0').status_code==422

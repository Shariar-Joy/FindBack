"""Measured local sync/async experiment using a separate FastAPI harness + PG + Mailpit.

Never adds a synchronous-delivery endpoint to the production app. Each run creates
and removes one isolated schema. Measurements are in-process TestClient request
latency, not a deployed network benchmark. Test mail goes only to localhost:1025.
"""
import json
from pathlib import Path
import statistics
import sys
import time
import uuid
from datetime import timedelta
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.core.config import get_settings
from app.models import Base, EmailOutbox, JobStatus, now
from app.workers import notifications


def summarize(samples):
    values=sorted(samples)
    return {"median_ms":round(statistics.median(values),2),"p95_ms":round(values[min(len(values)-1,int(len(values)*.95))],2)}


def main():
    settings=get_settings()
    url=make_url(settings.database_url)
    if settings.environment!='development' or url.host not in {'127.0.0.1','localhost'}:
        raise SystemExit('Run only against local development PostgreSQL and Mailpit.')
    schema='experiment_'+uuid.uuid4().hex
    admin=create_engine(url)
    with admin.begin() as db:
        db.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine=create_engine(url.update_query_dict({'options':f'-csearch_path={schema}'}))
    Base.metadata.create_all(engine)
    factory=sessionmaker(engine,expire_on_commit=False)
    notifications.SessionLocal=factory
    settings.email_backend='smtp';settings.smtp_host='127.0.0.1';settings.smtp_port=1025
    settings.smtp_username='';settings.smtp_password='';settings.smtp_tls=False
    harness=FastAPI()
    recipients=5
    rounds=10
    delivery=notifications.send_email
    @harness.post('/sync')
    def sync():
        for i in range(recipients):
            delivery(f'experiment-{i}@example.com','FindBack local experiment','Synthetic test email only.',uuid.uuid4().hex)
        return {'delivered':recipients}
    @harness.post('/async')
    def asynchronous():
        with factory.begin() as db:
            for i in range(recipients):
                db.add(EmailOutbox(recipient=f'experiment-{i}@example.com',subject='FindBack local experiment',body='Synthetic test email only.'))
        return {'queued':recipients}
    result={'scope':'Local separate FastAPI TestClient harness, PostgreSQL and Mailpit; no network API latency or cloud claims','requests_per_mode':rounds,'recipients_per_request':recipients}
    try:
        with TestClient(harness) as client:
            for mode in ['sync','async']:
                api_times=[];completion=[];failed=0
                for _ in range(rounds):
                    start=time.perf_counter()
                    response=client.post('/'+mode)
                    api_times.append((time.perf_counter()-start)*1000)
                    failed+=response.status_code!=200
                    if mode=='async':
                        while notifications.process_one(EmailOutbox):
                            pass
                    completion.append((time.perf_counter()-start)*1000)
                result[mode]={'api':summarize(api_times),'notification_completion':summarize(completion),'failed_requests':failed}
        # Inject a failure, then simulate a worker dying after claiming its retry.
        with factory.begin() as db:
            job=EmailOutbox(recipient='recovery@example.com',subject='FindBack recovery test',body='Synthetic recovery experiment')
            db.add(job);db.flush();job_id=job.id
        def fail(*args):
            raise ConnectionError('Injected experiment failure')
        notifications.send_email=fail
        notifications.process_one(EmailOutbox)
        with factory.begin() as db:
            job=db.get(EmailOutbox,job_id)
            backoff=(job.available_at.replace(tzinfo=None)-now().replace(tzinfo=None)).total_seconds()
            job.available_at=now()-timedelta(seconds=1)
        claim=notifications.claim(EmailOutbox)
        with factory.begin() as db:
            db.get(EmailOutbox,job_id).lease_until=now()-timedelta(seconds=1)
        notifications.send_email=delivery
        start=time.perf_counter();notifications.process_one(EmailOutbox)
        with factory() as db:
            job=db.get(EmailOutbox,job_id)
            result['recovery']={'injected_delivery_failures':1,'backoff_scheduled_seconds':round(backoff,2),'attempts_including_abandoned_claim':job.attempts,'final_status':job.status.value,'recovery_processing_ms':round((time.perf_counter()-start)*1000,2),'duplicate_pending_work':notifications.process_one(EmailOutbox)}
        path=ROOT/'docs'/'notification-experiment-results.json'
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps(result,indent=2),encoding='utf-8')
        print(json.dumps(result))
    finally:
        engine.dispose()
        with admin.begin() as db:
            db.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


if __name__=='__main__':
    main()

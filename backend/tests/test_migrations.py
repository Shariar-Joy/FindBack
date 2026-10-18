import os
import uuid
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from app.core.config import get_settings


@pytest.mark.skipif(not os.environ.get('TEST_DATABASE_URL'), reason='PostgreSQL migration test requires TEST_DATABASE_URL')
def test_migration_upgrade_downgrade_upgrade(monkeypatch):
    url = make_url(os.environ['TEST_DATABASE_URL'])
    engine = create_engine(url)
    schema = 'migration_' + uuid.uuid4().hex
    with engine.begin() as db:
        db.execute(text(f'CREATE SCHEMA "{schema}"'))
    test_url = url.update_query_dict({'options': f'-csearch_path={schema}'})
    monkeypatch.setattr(get_settings(), 'database_url', test_url.render_as_string(hide_password=False))
    config = Config('alembic.ini')
    try:
        command.upgrade(config, 'head')
        command.downgrade(config, 'base')
        command.upgrade(config, 'head')
        test_engine = create_engine(test_url)
        assert 'notification_jobs' in inspect(test_engine).get_table_names()
        command.check(config)
        test_engine.dispose()
    finally:
        with engine.begin() as db:
            db.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        engine.dispose()

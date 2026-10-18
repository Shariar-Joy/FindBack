"""Browser tests use generated credentials and a disposable local PostgreSQL schema."""
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
import uuid
import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.core.config import get_settings


def wait_ready(url, process):
    for _ in range(80):
        if process.poll() is not None:
            raise RuntimeError(f"Test service stopped before readiness: {url}")
        try:
            if httpx.get(url, timeout=1).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(.25)
    raise RuntimeError(f"Service did not become ready: {url}")


def main():
    settings = get_settings()
    if settings.environment != "development" or not settings.database_url.startswith("postgresql"):
        raise SystemExit("This harness requires local development PostgreSQL.")
    base_url = make_url(settings.database_url)
    if base_url.host not in {"127.0.0.1", "localhost"}:
        raise SystemExit("Only a local PostgreSQL host is allowed.")
    engine = create_engine(base_url)
    schema = "e2e_" + uuid.uuid4().hex
    with engine.begin() as db:
        db.execute(text(f'CREATE SCHEMA "{schema}"'))
    url = base_url.update_query_dict({"options": f"-csearch_path={schema}"})
    env = {**os.environ, "DATABASE_URL": url.render_as_string(hide_password=False), "ENVIRONMENT": "development",
           "DEMO_PASSWORD": "E2e" + secrets.token_hex(12) + "A1", "ALLOW_DEMO_EMAIL": "true",
           "SMTP_HOST": "127.0.0.1", "SMTP_PORT": "1025", "SMTP_USERNAME": "", "SMTP_PASSWORD": "", "SMTP_TLS": "false",
           "EMAIL_BACKEND": "smtp", "STORAGE_BACKEND": "local", "STORAGE_PATH": str(ROOT / "tmp" / schema),
           "RATE_LIMIT_ENABLED": "false", "FRONTEND_URL": "http://127.0.0.1:5174",
           "ALLOWED_ORIGINS": "http://127.0.0.1:5174,http://127.0.0.1:8010",
           "E2E_BASE_URL": "http://127.0.0.1:5174", "E2E_API_URL": "http://127.0.0.1:8010",
           "VITE_BACKEND_TARGET": "http://127.0.0.1:8010", "VITE_API_URL": "", "WORKER_POLL_SECONDS": ".25"}
    if not env.get("PLAYWRIGHT_EXECUTABLE_PATH"):
        cached = sorted((Path.home() / "AppData/Local/ms-playwright").glob("chromium-*/chrome-win64/chrome.exe"))
        if cached:
            env["PLAYWRIGHT_EXECUTABLE_PATH"] = str(cached[-1])
    processes, logs = [], []
    backend = ROOT / "backend"
    npm = "npm.cmd" if os.name == "nt" else "npm"
    (ROOT / "tmp").mkdir(exist_ok=True)
    try:
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=backend, env=env, check=True)
        subprocess.run([sys.executable, "-m", "app.cli", "seed"], cwd=backend, env=env, check=True)
        for name, cmd, cwd in [
            ("api", [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8010", "--no-access-log"], backend),
            ("worker", [sys.executable, "-m", "app.workers.notifications"], backend),
            ("frontend", [npm, "run", "dev", "--", "--port", "5174", "--strictPort"], ROOT / "frontend"),
        ]:
            log = (ROOT / "tmp" / f"e2e-{name}.log").open("w", encoding="utf-8")
            logs.append(log)
            flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            processes.append(subprocess.Popen(cmd, cwd=cwd, env=env, stdout=log, stderr=log, creationflags=flags))
        wait_ready("http://127.0.0.1:8010/ready", processes[0])
        wait_ready("http://127.0.0.1:5174", processes[2])
        result = subprocess.run([npm, "run", "test:e2e"], cwd=ROOT / "frontend", env=env)
        return result.returncode
    finally:
        for process in reversed(processes):
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                process.terminate()
            process.wait(timeout=10)
        for log in logs:
            log.close()
        with engine.begin() as db:
            db.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())

"""Check tracked publication files without reading ignored developer secrets."""
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_DIRS = {"node_modules", ".venv", ".vite", "__pycache__", ".pytest_cache", "dist",
                  "tmp", "test-results", "playwright-report", ".aws", ".terraform"}
SECRETS = [re.compile(r"(?:AKIA|ASIA)[A-Z0-9]{16}"),
           re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}"),
           re.compile(r"github_pat_[A-Za-z0-9_]{60,}"),
           re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")]


def main():
    result = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True)
    paths = [Path(p) for p in result.stdout.decode("utf-8").split("\0") if p]
    errors = []
    for relative in paths:
        path = ROOT / relative
        name = path.name
        example = name.endswith(".example") or name.endswith(".sample")
        if FORBIDDEN_DIRS.intersection(relative.parts) or relative.parts[:2] == ("backend", "storage") or (name.startswith(".env") and not example) or name.endswith((".pyc", ".tsbuildinfo", ".db", ".pem", ".key", ".pfx", ".p12")):
            errors.append(f"Generated/private file tracked: {relative}")
        if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".pdf", ".woff", ".woff2"}:
            continue
        content = path.read_text(encoding="utf-8")
        if any(pattern.search(content) for pattern in SECRETS):
            errors.append(f"Possible credential in: {relative} (value withheld)")
        if path.suffix == ".json":
            try:
                json.loads(content)
            except ValueError:
                errors.append(f"Invalid JSON: {relative}")
        if path.suffix == ".md":
            for target in re.findall(r"!?\[[^\]]*\]\(([^\s)]+)\)", content):
                if "://" in target or target.startswith(("#", "mailto:")):
                    continue
                destination = target.split("#", 1)[0]
                if destination and not (path.parent / destination).exists():
                    errors.append(f"Broken documentation link in {relative}: {target}")
    if errors:
        print("\n".join(errors))
        return 1
    print(f"Repository checks passed: {len(paths)} tracked files; no generated/private paths, known credential formats, invalid JSON, or broken local Markdown links.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

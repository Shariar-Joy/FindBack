import json
import logging
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record):
        result = {"time": datetime.now(timezone.utc).isoformat(), "level": record.levelname, "logger": record.name, "event": record.getMessage()}
        for key in ["request_id", "method", "status", "duration_ms", "event_id", "job_status", "attempts"]:
            if hasattr(record, key):
                result[key] = getattr(record, key)
        return json.dumps(result)


def configure_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("findback")
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False

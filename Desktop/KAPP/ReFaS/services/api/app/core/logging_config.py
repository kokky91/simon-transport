import logging

from pythonjsonlogger.json import JsonFormatter


def configure_logging() -> None:
    logger = logging.getLogger()

    if logger.handlers:
        logger.handlers.clear()

    handler = logging.StreamHandler()
    formatter = JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s %(traceId)s %(tenantId)s %(eventType)s %(service)s"
    )

    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

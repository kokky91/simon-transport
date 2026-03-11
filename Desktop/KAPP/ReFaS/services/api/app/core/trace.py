import uuid

from fastapi import Request

TRACE_HEADER = "X-Trace-Id"


def get_trace_id(request: Request) -> str:
    trace_id = request.headers.get(TRACE_HEADER)
    return trace_id or str(uuid.uuid4())

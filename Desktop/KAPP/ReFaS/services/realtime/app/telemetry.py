from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider


def configure_telemetry(service_name: str) -> None:
    provider = trace.get_tracer_provider()
    if isinstance(provider, TracerProvider):
        return

    resource = Resource.create({"service.name": service_name})
    trace.set_tracer_provider(TracerProvider(resource=resource))

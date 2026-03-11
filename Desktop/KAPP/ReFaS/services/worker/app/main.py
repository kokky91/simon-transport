import os

from prometheus_client import start_http_server

from tick_loop import start_tick_loop


def main() -> None:
    metrics_port = int(os.getenv("WORKER_METRICS_PORT", "9102"))
    start_http_server(metrics_port)
    start_tick_loop()


if __name__ == "__main__":
    main()

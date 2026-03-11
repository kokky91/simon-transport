import argparse
import json
import math
import os
import subprocess
import time
import urllib.parse
import urllib.request


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    return int(value) if value else default


def env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    return float(value) if value else default


PROM_URL = os.getenv("PROM_URL", "http://localhost:9090")
WORKSPACE_COMPOSE_FILE = os.getenv("WORKER_COMPOSE_FILE", "docker-compose.dev.yml")

WORKER_MIN_REPLICAS = env_int("WORKER_MIN_REPLICAS", 1)
WORKER_MAX_REPLICAS = env_int("WORKER_MAX_REPLICAS", 6)
WORKER_SCALE_UP_STEP = env_int("WORKER_SCALE_UP_STEP", 1)
WORKER_SCALE_DOWN_STEP = env_int("WORKER_SCALE_DOWN_STEP", 1)
WORKER_SCALE_COOLDOWN_SECONDS = env_int("WORKER_SCALE_COOLDOWN_SECONDS", 120)

WORKER_SCALE_UP_BACKLOG_THRESHOLD = env_float("WORKER_SCALE_UP_BACKLOG_THRESHOLD", 10.0)
WORKER_SCALE_UP_LATENCY_P95_THRESHOLD = env_float("WORKER_SCALE_UP_LATENCY_P95_THRESHOLD", 0.35)

WORKER_SCALE_DOWN_PUBLISH_RATE_THRESHOLD = env_float("WORKER_SCALE_DOWN_PUBLISH_RATE_THRESHOLD", 3.0)
WORKER_SCALE_DOWN_BACKLOG_THRESHOLD = env_float("WORKER_SCALE_DOWN_BACKLOG_THRESHOLD", 0.5)
WORKER_SCALE_DOWN_LATENCY_P95_THRESHOLD = env_float("WORKER_SCALE_DOWN_LATENCY_P95_THRESHOLD", 0.2)

PUBLISH_RATE_QUERY = "sum(rate(events_published_total[1m]))"
CONSUME_RATE_QUERY = "sum(rate(events_consumed_total[1m]))"
PUBLISH_LATENCY_P95_QUERY = (
    "histogram_quantile(0.95, sum(rate(event_publish_latency_seconds_bucket[5m])) by (le))"
)


def query_prometheus(expr: str) -> float:
    encoded = urllib.parse.urlencode({"query": expr})
    url = f"{PROM_URL}/api/v1/query?{encoded}"
    with urllib.request.urlopen(url, timeout=10) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    results = payload.get("data", {}).get("result", [])
    if not results:
        return 0.0

    value = results[0].get("value", [0, "0"])[1]
    try:
        parsed = float(value)
        if not math.isfinite(parsed):
            return 0.0
        return parsed
    except ValueError:
        return 0.0


def get_current_worker_replicas() -> int:
    cmd = ["docker", "compose", "-f", WORKSPACE_COMPOSE_FILE, "ps", "--format", "json", "worker"]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    output = result.stdout.strip()
    if not output:
        return 0

    lines = [line for line in output.splitlines() if line.strip()]
    return len(lines)


def apply_worker_scale(target_replicas: int, dry_run: bool) -> None:
    cmd = [
        "docker",
        "compose",
        "-f",
        WORKSPACE_COMPOSE_FILE,
        "up",
        "-d",
        "--scale",
        f"worker={target_replicas}",
        "worker",
    ]

    if dry_run:
        print(f"[DRY-RUN] {' '.join(cmd)}")
        return

    subprocess.run(cmd, check=True)
    print(f"Applied worker scale: {target_replicas}")


def evaluate_target_replicas(current_replicas: int) -> tuple[int, str, dict[str, float]]:
    publish_rate = query_prometheus(PUBLISH_RATE_QUERY)
    consume_rate = query_prometheus(CONSUME_RATE_QUERY)
    latency_p95 = query_prometheus(PUBLISH_LATENCY_P95_QUERY)

    backlog_growth = publish_rate - consume_rate

    metrics = {
        "publish_rate": publish_rate,
        "consume_rate": consume_rate,
        "backlog_growth": backlog_growth,
        "publish_latency_p95": latency_p95,
    }

    scale_up = (
        backlog_growth > WORKER_SCALE_UP_BACKLOG_THRESHOLD
        or latency_p95 > WORKER_SCALE_UP_LATENCY_P95_THRESHOLD
    )

    scale_down = (
        publish_rate < WORKER_SCALE_DOWN_PUBLISH_RATE_THRESHOLD
        and backlog_growth <= WORKER_SCALE_DOWN_BACKLOG_THRESHOLD
        and latency_p95 < WORKER_SCALE_DOWN_LATENCY_P95_THRESHOLD
    )

    target = current_replicas
    reason = "hold"

    if scale_up:
        target = min(current_replicas + WORKER_SCALE_UP_STEP, WORKER_MAX_REPLICAS)
        reason = "scale_up"
    elif scale_down:
        target = max(current_replicas - WORKER_SCALE_DOWN_STEP, WORKER_MIN_REPLICAS)
        reason = "scale_down"

    if target == current_replicas:
        reason = "hold"

    return target, reason, metrics


def run_loop(dry_run: bool, interval_seconds: int) -> None:
    last_action = 0.0

    while True:
        current = get_current_worker_replicas()
        if current <= 0:
            current = WORKER_MIN_REPLICAS

        target, reason, metrics = evaluate_target_replicas(current)
        now = time.time()

        print(
            json.dumps(
                {
                    "service": "worker-autoscaler",
                    "current_replicas": current,
                    "target_replicas": target,
                    "decision": reason,
                    **metrics,
                }
            )
        )

        if target != current and now - last_action >= WORKER_SCALE_COOLDOWN_SECONDS:
            apply_worker_scale(target, dry_run=dry_run)
            last_action = now

        time.sleep(interval_seconds)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compose worker autoscaler based on Prometheus signals")
    parser.add_argument("--dry-run", action="store_true", help="Print scaling actions without applying")
    parser.add_argument("--once", action="store_true", help="Run single evaluation cycle")
    parser.add_argument("--interval", type=int, default=30, help="Polling interval in seconds")
    args = parser.parse_args()

    if args.once:
        current = get_current_worker_replicas()
        target, reason, metrics = evaluate_target_replicas(current)
        print(
            json.dumps(
                {
                    "service": "worker-autoscaler",
                    "current_replicas": current,
                    "target_replicas": target,
                    "decision": reason,
                    **metrics,
                }
            )
        )
        if target != current:
            apply_worker_scale(target, dry_run=args.dry_run)
        return

    run_loop(dry_run=args.dry_run, interval_seconds=args.interval)


if __name__ == "__main__":
    main()

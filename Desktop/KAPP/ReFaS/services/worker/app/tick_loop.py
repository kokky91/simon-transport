import os
import time
import uuid

from game.engine import engine
from command_repository import WorkerCommandRepository
from sim_engine import DomainSnapshot, FarmSimEngine
from world_lock import RedisWorldLock

from metrics import (
    ACTIVE_WORLDS,
    ENTITIES_PROCESSED,
    EVENTS_EMITTED_TOTAL,
    GAME_COMMAND_RETRY_TOTAL,
    GAME_COMMANDS_DEAD_TOTAL,
    GAME_COMMANDS_FAILED_TOTAL,
    GAME_COMMANDS_PROCESSED_TOTAL,
    GAME_WORLD_LOCK_ACQUIRED_TOTAL,
    GAME_WORLD_LOCK_SKIPPED_TOTAL,
    SIM_COMMANDS_FAILED_TOTAL,
    SIM_COMMANDS_PROCESSED_TOTAL,
    SIM_RUNS_COMPLETED_TOTAL,
    TICKS_TOTAL,
    TICK_DURATION_SECONDS,
)

TICK_RATE_SECONDS = float(os.getenv("GAME_TICK_RATE_SECONDS", "1.0"))
GAME_TENANT_ID = os.getenv("GAME_TICK_TENANT_ID", "tenant-game-loop")
GAME_WORLD_ID = os.getenv("GAME_WORLD_ID", f"{GAME_TENANT_ID}:world")
GAME_TICK_SIMULATED_WORK_SECONDS = float(os.getenv("GAME_TICK_SIMULATED_WORK_SECONDS", "0"))

command_repo = WorkerCommandRepository()
world_lock = RedisWorldLock()
sim_engine = FarmSimEngine()


def process_sim_commands() -> None:
    commands = command_repo.fetch_pending_sim_commands(limit=20)

    for command in commands:
        command_type = command.get("commandType", "UNKNOWN")
        run_id = command.get("runId")
        if not isinstance(run_id, str) or not run_id:
            command_repo.mark_sim_failed(command_id=command["id"], error="Missing runId")
            SIM_COMMANDS_FAILED_TOTAL.labels(
                command_type=command_type,
                tenant_id=command.get("tenantId", GAME_TENANT_ID),
            ).inc()
            continue

        try:
            command_repo.set_sim_run_status(run_id=run_id, status="running")

            payload = command.get("payload", {})
            snapshot_data = payload.get("snapshot")
            if not isinstance(snapshot_data, dict):
                raise ValueError("Missing snapshot in simulation command payload")

            snapshot = DomainSnapshot(
                tenant_id=command["tenantId"],
                world_id=GAME_WORLD_ID,
                tasks=float(snapshot_data.get("tasks", 0)),
                fields=float(snapshot_data.get("fields", 0)),
                costs=float(snapshot_data.get("costs", 0)),
                avg_task_duration_minutes=float(snapshot_data.get("avgTaskDurationMinutes", 0)),
            )

            sim_result = sim_engine.run(snapshot=snapshot, days=int(payload.get("days", 30)))
            command_repo.insert_sim_result(
                result_id=str(uuid.uuid4()),
                tenant_id=command["tenantId"],
                run_id=run_id,
                metric_key="projected_cost_delta",
                metric_value=sim_result["projected_cost_delta"],
                details=sim_result,
            )
            command_repo.insert_sim_result(
                result_id=str(uuid.uuid4()),
                tenant_id=command["tenantId"],
                run_id=run_id,
                metric_key="projected_duration_delta",
                metric_value=sim_result["projected_duration_delta"],
                details=sim_result,
            )

            command_repo.mark_sim_processed(command_id=command["id"])
            command_repo.set_sim_run_status(run_id=run_id, status="completed")

            SIM_COMMANDS_PROCESSED_TOTAL.labels(
                command_type=command_type,
                tenant_id=command["tenantId"],
            ).inc()
            SIM_RUNS_COMPLETED_TOTAL.labels(tenant_id=command["tenantId"]).inc()
        except Exception as exc:
            command_repo.mark_sim_failed(command_id=command["id"], error=str(exc))
            if run_id:
                command_repo.set_sim_run_status(run_id=run_id, status="failed")
            SIM_COMMANDS_FAILED_TOTAL.labels(
                command_type=command_type,
                tenant_id=command.get("tenantId", GAME_TENANT_ID),
            ).inc()


def start_tick_loop() -> None:
    last_tick_at = time.time()

    while True:
        now = time.time()
        delta = now - last_tick_at

        if delta >= TICK_RATE_SECONDS:
            acquired, lock_token = world_lock.acquire(GAME_WORLD_ID)
            if not acquired:
                GAME_WORLD_LOCK_SKIPPED_TOTAL.labels(
                    world_id=GAME_WORLD_ID,
                    tenant_id=GAME_TENANT_ID,
                ).inc()
                last_tick_at = now
                time.sleep(0.01)
                continue

            GAME_WORLD_LOCK_ACQUIRED_TOTAL.labels(
                world_id=GAME_WORLD_ID,
                tenant_id=GAME_TENANT_ID,
            ).inc()

            tick_start = time.perf_counter()
            try:
                commands = command_repo.fetch_unprocessed(
                    tenant_id=GAME_TENANT_ID,
                    world_id=GAME_WORLD_ID,
                    limit=50,
                )
                for command in commands:
                    command_type = command.get("type", "UNKNOWN")
                    try:
                        engine.handle_command(command)
                        command_repo.mark_processed(command["id"])
                        GAME_COMMANDS_PROCESSED_TOTAL.labels(
                            command_type=command_type,
                            tenant_id=GAME_TENANT_ID,
                        ).inc()
                    except Exception as exc:
                        fail_result = command_repo.mark_failed(command["id"], str(exc))
                        GAME_COMMANDS_FAILED_TOTAL.labels(
                            command_type=command_type,
                            tenant_id=GAME_TENANT_ID,
                        ).inc()
                        if fail_result.get("is_dead"):
                            GAME_COMMANDS_DEAD_TOTAL.labels(
                                command_type=command_type,
                                tenant_id=GAME_TENANT_ID,
                            ).inc()
                        else:
                            GAME_COMMAND_RETRY_TOTAL.labels(
                                command_type=command_type,
                                tenant_id=GAME_TENANT_ID,
                            ).inc()

                events = engine.tick(delta=delta, tenant_id=GAME_TENANT_ID)
                if GAME_TICK_SIMULATED_WORK_SECONDS > 0:
                    time.sleep(GAME_TICK_SIMULATED_WORK_SECONDS)
                duration = time.perf_counter() - tick_start

                TICKS_TOTAL.inc()
                TICK_DURATION_SECONDS.observe(duration)
                ACTIVE_WORLDS.set(1)
                ENTITIES_PROCESSED.set(len(engine.world.all_entities()))
                for event in events:
                    EVENTS_EMITTED_TOTAL.labels(
                        event_type=event.get("type", "UNKNOWN"),
                        tenant_id=event.get("tenantId", GAME_TENANT_ID),
                    ).inc()

                process_sim_commands()
            finally:
                world_lock.release(GAME_WORLD_ID, lock_token)

            last_tick_at = now

        time.sleep(0.01)

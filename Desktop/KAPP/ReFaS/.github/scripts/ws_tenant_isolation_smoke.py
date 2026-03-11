import asyncio
import jwt
import websockets

SECRET = "supersecretkey"
ALGORITHM = "HS256"


async def main() -> None:
    ok_token = jwt.encode({"tenantId": "tenant-ci"}, SECRET, algorithm=ALGORITHM)
    bad_token = jwt.encode({"tenantId": "tenant-other"}, SECRET, algorithm=ALGORITHM)

    async with websockets.connect(f"ws://localhost:8003/ws/tenant-ci?token={ok_token}"):
        pass

    rejected = False
    try:
        async with websockets.connect(f"ws://localhost:8003/ws/tenant-ci?token={bad_token}"):
            pass
    except Exception:
        rejected = True

    if not rejected:
        raise SystemExit("Expected tenant mismatch websocket rejection")


if __name__ == "__main__":
    asyncio.run(main())

import base64
import http.client
import os


def main() -> None:
    host = os.getenv("WS_SMOKE_HOST", "localhost")
    port = int(os.getenv("WS_SMOKE_PORT", "8003"))
    tenant = os.getenv("WS_SMOKE_TENANT", "tenant-ci-origin")
    disallowed_origin = os.getenv("WS_SMOKE_BLOCKED_ORIGIN", "http://evil.local")

    key = base64.b64encode(os.urandom(16)).decode("ascii")
    headers = {
        "Host": f"{host}:{port}",
        "Upgrade": "websocket",
        "Connection": "Upgrade",
        "Sec-WebSocket-Key": key,
        "Sec-WebSocket-Version": "13",
        "Origin": disallowed_origin,
    }

    conn = http.client.HTTPConnection(host, port, timeout=10)
    try:
        conn.request("GET", f"/ws/{tenant}", headers=headers)
        response = conn.getresponse()
        status = response.status
        response.read()
    finally:
        conn.close()

    if status != 403:
        raise SystemExit(f"Expected WS origin reject HTTP 403, got {status}")

    print(f"WS origin reject passed: status={status}")


if __name__ == "__main__":
    main()

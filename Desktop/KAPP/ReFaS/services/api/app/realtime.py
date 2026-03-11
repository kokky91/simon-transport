from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI(title="FarmPlatform Realtime")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "realtime"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            message = await websocket.receive_text()
            await websocket.send_text(f"echo:{message}")
    except WebSocketDisconnect:
        return

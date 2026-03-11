import { useSessionStore } from "../../store/sessionStore";
import { useTenantStore } from "../../store/tenantStore";

const DEFAULT_REALTIME_BASE_URL = "ws://localhost:8003";

export type SimulationRealtimeEvent = {
  tenantId: string;
  type: string;
  payload: unknown;
};

function resolveRealtimeBaseUrl() {
  return import.meta.env.VITE_REALTIME_BASE_URL ?? DEFAULT_REALTIME_BASE_URL;
}

export function createSimulationSocket() {
  const { accessToken } = useSessionStore.getState();
  const { tenantId } = useTenantStore.getState();

  if (!tenantId) {
    throw new Error("Tenant is required before opening realtime connection.");
  }

  if (!accessToken) {
    throw new Error("Access token is required before opening realtime connection.");
  }

  const url = new URL(`${resolveRealtimeBaseUrl()}/ws/${tenantId}`);
  url.searchParams.set("token", accessToken);

  return new WebSocket(url);
}

export function attachRealtimeListener(
  socket: WebSocket,
  onSimulationEvent: (event: SimulationRealtimeEvent) => void
) {
  socket.onmessage = (message) => {
    const parsed = JSON.parse(String(message.data)) as SimulationRealtimeEvent;
    if (parsed.tenantId !== useTenantStore.getState().tenantId) {
      return;
    }
    onSimulationEvent(parsed);
  };
}
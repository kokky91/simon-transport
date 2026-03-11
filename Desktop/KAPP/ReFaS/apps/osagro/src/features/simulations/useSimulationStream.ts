import { useEffect, useState } from "react";
import {
  attachRealtimeListener,
  createSimulationSocket,
  type SimulationRealtimeEvent
} from "../../lib/realtime/realtimeListener";

export function useSimulationStream() {
  const [events, setEvents] = useState<SimulationRealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState<string | null>(null);

  useEffect(() => {
    let socket: WebSocket;
    let isUnmounting = false;

    try {
      socket = createSimulationSocket();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Failed to create websocket.";
      setConnectionIssue(reason);
      return;
    }

    socket.onopen = () => {
      setIsConnected(true);
      setConnectionIssue(null);
    };
    socket.onerror = () => {
      setConnectionIssue("WebSocket error. Check realtime service URL and authentication token.");
    };
    socket.onclose = (event) => {
      setIsConnected(false);
      if (isUnmounting || event.code === 1000) {
        return;
      }
      setConnectionIssue(
        `WebSocket closed (code ${event.code}${event.reason ? `: ${event.reason}` : ""}).`
      );
    };
    attachRealtimeListener(socket, (event) => {
      setEvents((current) => [event, ...current].slice(0, 30));
    });

    return () => {
      isUnmounting = true;
      socket.close();
    };
  }, []);

  return {
    events,
    isConnected,
    connectionIssue
  };
}
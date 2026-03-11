export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8002",
  realtimeBaseUrl: import.meta.env.VITE_REALTIME_BASE_URL ?? "ws://localhost:8003"
};
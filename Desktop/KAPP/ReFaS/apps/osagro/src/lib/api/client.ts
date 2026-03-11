
import { useSessionStore } from "../../store/sessionStore";
import { AUTH_STORAGE_KEY } from "../../features/auth/auth.types";
import { useTenantStore } from "../../store/tenantStore";

const DEFAULT_API_BASE_URL = "http://localhost:8002";

type RequestOptions = {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	headers?: Record<string, string>;
};

type FormDataRequestOptions = {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: FormData;
	headers?: Record<string, string>;
};

function resolveApiBaseUrl() {
	return import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

async function parseApiResponse<TResponse>(response: Response) {
	const responseText = await response.text();
	let responseBody: unknown = null;
	if (responseText) {
		try {
			responseBody = JSON.parse(responseText);
		} catch {
			responseBody = responseText;
		}
	}

	if (!response.ok) {
		if (response.status === 401) {
			useSessionStore.getState().clearSession();
			useTenantStore.getState().clearTenant();
			localStorage.removeItem(AUTH_STORAGE_KEY);
		}
		const detail =
			responseBody && typeof responseBody === "object" && "detail" in responseBody
				? String((responseBody as { detail?: unknown }).detail ?? "")
				: "";
		throw new Error(detail || `API request failed: ${response.status}`);
	}
	return (responseBody ?? {}) as TResponse;
}

export async function apiRequest<TResponse>(path: string, options: RequestOptions = {}) {
	const token = useSessionStore.getState().accessToken;
	const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
		method: options.method ?? "GET",
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(options.headers ?? {})
		},
		body: options.body ? JSON.stringify(options.body) : undefined
	});
	return parseApiResponse<TResponse>(response);
}

export async function apiRequestFormData<TResponse>(path: string, options: FormDataRequestOptions = {}) {
	const token = useSessionStore.getState().accessToken;
	const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
		method: options.method ?? "GET",
		headers: {
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(options.headers ?? {})
		},
		body: options.body
	});
	return parseApiResponse<TResponse>(response);
}

const apiClient = {
	post: <TResponse>(path: string, body: unknown, headers?: Record<string, string>) =>
		apiRequest<TResponse>(path, { method: "POST", body, headers }),
	get: <TResponse>(path: string, headers?: Record<string, string>) =>
		apiRequest<TResponse>(path, { method: "GET", headers }),
	put: <TResponse>(path: string, body: unknown, headers?: Record<string, string>) =>
		apiRequest<TResponse>(path, { method: "PUT", body, headers }),
	patch: <TResponse>(path: string, body: unknown, headers?: Record<string, string>) =>
		apiRequest<TResponse>(path, { method: "PATCH", body, headers }),
	delete: <TResponse>(path: string, headers?: Record<string, string>) =>
		apiRequest<TResponse>(path, { method: "DELETE", headers }),
};

export { apiClient };



























































































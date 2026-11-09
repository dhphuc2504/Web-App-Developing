import { tokenStore } from "./token.js";
export const API_CONFIG = Object.freeze({
  root: "/api",
  headers: { Accept: "application/json" },
  timeoutMs: 15000,
});
export class ApiError extends Error {
  constructor(layer, code, message, fields = {}, status = 0) {
    super(message);
    Object.assign(this, { layer, code, fields, status });
  }
}
export function createApiClient({
  fetchImpl = (...args) => fetch(...args),
  onPending = () => {},
  onUnauthorized = () => {},
  config = API_CONFIG,
} = {}) {
  async function request(
    path,
    {
      method = "GET",
      body,
      signal,
      timeoutMs = config.timeoutMs,
      background = false,
      blockUI = true,
    } = {},
  ) {
    const blocking = blockUI && (method !== "GET" || !background);
    if (blocking) onPending(1);
    try {
      let response;
      try {
        response = await fetchImpl(config.root + path, {
          method,
          credentials: "omit",
          headers: {
            ...config.headers,
            ...(body !== undefined && !(body instanceof FormData)
              ? { "Content-Type": "application/json" }
              : {}),
            ...(tokenStore.get()
              ? { Authorization: "Bearer " + tokenStore.get() }
              : {}),
          },
          ...(body !== undefined
            ? { body: body instanceof FormData ? body : JSON.stringify(body) }
            : {}),
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
            : AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (signal?.aborted)
          throw new ApiError("network", "CANCELLED", "Request cancelled.");
        throw new ApiError(
          "network",
          error.name === "TimeoutError" ? "TIMEOUT" : "NETWORK_ERROR",
          "The request could not be confirmed. Check your connection and retry without changing the form.",
        );
      }
      let result;
      try {
        if (!response.headers.get("content-type")?.includes("application/json"))
          throw new Error();
        result = await response.json();
        if (
          typeof result?.ok !== "boolean" ||
          (result.ok
            ? !Object.hasOwn(result, "data")
            : typeof result.error?.code !== "string" ||
              typeof result.error?.message !== "string")
        )
          throw new Error();
      } catch {
        throw new ApiError(
          "http",
          "INVALID_RESPONSE",
          "The server returned an unreadable response.",
          {},
          response.status,
        );
      }
      if (!response.ok) {
        if (response.status === 401) {
          tokenStore.set(null);
          onUnauthorized();
        }
        throw new ApiError(
          "http",
          result.error?.code || "HTTP_ERROR",
          result.error?.message || "The request failed.",
          result.error?.fields,
          response.status,
        );
      }
      if (!result.ok) {
        throw new ApiError(
          "application",
          result.error.code,
          result.error.message,
          result.error.fields,
          response.status,
        );
      }
      if (result.data?.accessToken) tokenStore.set(result.data.accessToken);
      if (path === "/auth/logout" && method === "DELETE") tokenStore.set(null);
      return result.data;
    } finally {
      if (blocking) onPending(-1);
    }
  }
  return { request };
}
let pending = 0;
const listeners = new Set(),
  authListeners = new Set();
export const activity = {
  subscribe: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot: () => pending,
};
export const authEvents = {
  subscribe: (fn) => {
    authListeners.add(fn);
    return () => authListeners.delete(fn);
  },
};
export const http = createApiClient({
  onPending: (delta) => {
    pending += delta;
    listeners.forEach((fn) => fn());
  },
  onUnauthorized: () => authListeners.forEach((fn) => fn()),
});

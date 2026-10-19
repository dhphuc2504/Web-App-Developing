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
  let csrfToken = null;
  async function request(
    path,
    { method = "GET", body, signal, timeoutMs = config.timeoutMs } = {},
  ) {
    onPending(1);
    try {
      if (method !== "GET" && !csrfToken) await request("/session", { signal });
      let response;
      try {
        response = await fetchImpl(config.root + path, {
          method,
          credentials: "same-origin",
          headers: {
            ...config.headers,
            ...(body !== undefined && !(body instanceof FormData)
              ? { "Content-Type": "application/json" }
              : {}),
            ...(method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}),
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
        if (result.error?.code === "CSRF_INVALID") csrfToken = null;
        if (response.status === 401) onUnauthorized();
        throw new ApiError(
          "http",
          result.error?.code || "HTTP_ERROR",
          result.error?.message || "The request failed.",
          result.error?.fields,
          response.status,
        );
      }
      if (!result.ok) {
        if (result.error.code === "CSRF_INVALID") csrfToken = null;
        throw new ApiError(
          "application",
          result.error.code,
          result.error.message,
          result.error.fields,
          response.status,
        );
      }
      if (result.data?.csrfToken) csrfToken = result.data.csrfToken;
      if (path === "/session" && method === "DELETE") csrfToken = null;
      return result.data;
    } finally {
      onPending(-1);
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

// Never derive trusted origins from request Host or forwarded headers.
export function allowedOrigins(config) {
  const base = new URL(config.APP_ORIGIN || "http://localhost:3000");
  const origins = new Set([base.origin]);
  if (
    config.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1"].includes(base.hostname)
  ) {
    const alias = new URL(base.origin);
    alias.hostname = base.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.add(alias.origin);
  }
  return origins;
}
export function allowedCaptchaHostnames(config) {
  return new Set(
    [...allowedOrigins(config)].map((origin) => new URL(origin).hostname),
  );
}

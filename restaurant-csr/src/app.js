import { createMfaService } from "./services/mfa-service.js";
import express from "express";
import { allowedOrigins } from "./lib/origins.js";
import { createJwtService } from "./services/jwt-service.js";
import { createLoginService } from "./services/login-service.js";
import { createAccountService } from "./services/account-service.js";
import { createAccountDelivery } from "./services/account-delivery.js";
import { success } from "./lib/responses.js";
import { allow } from "./middleware/security.js";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createRepository } from "./models/repository.js";
import { createAuthService } from "./services/auth-service.js";
import { createCatalogService } from "./services/catalog-service.js";
import { createRecipeService } from "./services/recipe-service.js";
import { createStockService } from "./services/stock-service.js";
import { createPhotoService } from "./services/photo-service.js";
import { createApiController } from "./controllers/api-controller.js";
import { loadUser } from "./middleware/security.js";
import { createRoutes } from "./routes/index.js";
import { AppError } from "./lib/errors.js";
import { failure, errorHandler } from "./lib/responses.js";
export function createApp({
  db,
  config,
  photoService,
  delivery: injectedDelivery,
}) {
  const origins = allowedOrigins(config);
  const app = express(),
    repo = createRepository(db),
    photos = photoService || createPhotoService(config),
    jwt = createJwtService(config),
    delivery = injectedDelivery || createAccountDelivery(config),
    login = createLoginService(db, delivery, jwt, config),
    accounts = createAccountService(db, delivery),
    mfa = createMfaService(db, delivery, jwt, config);
  app.disable("x-powered-by");
  if (config.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": [
            "'self'",
            "https://www.google.com/recaptcha/",
            "https://www.gstatic.com/recaptcha/",
          ],
          "frame-src": [
            "'self'",
            "https://www.google.com/recaptcha/",
            "https://recaptcha.google.com/recaptcha/",
          ],
          "connect-src": ["'self'", "https://www.google.com/recaptcha/"],
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            ...(photos.origin ? [photos.origin] : []),
          ],
          "upgrade-insecure-requests":
            config.NODE_ENV === "production" ? [] : null,
        },
      },
      strictTransportSecurity:
        config.NODE_ENV === "production" ? undefined : false,
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.method === "POST" && req.path === "/dish-photos") {
      if (!req.is("multipart/form-data"))
        throw new AppError(
          422,
          "Upload a photo using multipart/form-data.",
          "CONTENT_TYPE_REQUIRED",
        );
      return next();
    }
    if (
      ["POST", "PUT", "PATCH"].includes(req.method) &&
      !req.is("application/json")
    )
      throw new AppError(
        422,
        "Send JSON with Content-Type: application/json.",
        "CONTENT_TYPE_REQUIRED",
      );
    next();
  });
  app.use("/api", express.json({ limit: "64kb" }));
  // No cookies or session middleware. Explicit CORS for the configured frontend only.
  app.use("/api", (req, res, next) => {
    const origin = req.get("Origin");
    if (origin && !origins.has(origin))
      throw new AppError(
        403,
        "This browser address is not allowed. Use the configured app address and restart the API after changing APP_ORIGIN.",
        "ORIGIN_DENIED",
      );
    if (origin) {
      res.set("Access-Control-Allow-Origin", origin);
      res.vary("Origin");
    }
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use("/api", loadUser(jwt));
  const authLimit = rateLimit({
    windowMs: 900000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) =>
      failure(
        res,
        200,
        "RATE_LIMITED",
        "Too many requests. Try again after 15 minutes.",
      ),
  });
  app.get("/api/auth/config", (req, res) =>
    success(res, { recaptchaSiteKey: config.RECAPTCHA_SITE_KEY || "" }),
  );
  app.get("/api/auth/me", allow("admin", "chef"), (req, res) =>
    success(res, { user: req.user }),
  );
  app.post("/api/auth/login", authLimit, async (req, res) =>
    success(res, await login.login(req.body)),
  );
  app.post("/api/auth/otp", authLimit, async (req, res) =>
    success(res, await login.verify(req.body)),
  );
  app.get("/api/auth/mfa", allow("admin"), async (req, res) =>
    success(res, await mfa.status(req.user)),
  );
  app.post("/api/auth/mfa/setup", allow("admin"), authLimit, async (req, res) =>
    success(res, await mfa.startSetup(req.user, req.body)),
  );
  app.post(
    "/api/auth/mfa/setup/verify",
    allow("admin"),
    authLimit,
    async (req, res) =>
      success(res, await mfa.verifySetupEmail(req.user, req.body)),
  );
  app.post(
    "/api/auth/mfa/setup/confirm",
    allow("admin"),
    authLimit,
    async (req, res) =>
      success(res, await mfa.confirmSetup(req.user, req.body)),
  );
  app.post(
    "/api/auth/mfa/setup/ack",
    allow("admin"),
    authLimit,
    async (req, res) =>
      success(res, await mfa.acknowledge(req.user, req.body, "setup_ack")),
  );
  app.post(
    "/api/auth/mfa/recovery",
    allow("admin"),
    authLimit,
    async (req, res) => success(res, await mfa.regenerate(req.user, req.body)),
  );
  app.post(
    "/api/auth/mfa/recovery/ack",
    allow("admin"),
    authLimit,
    async (req, res) =>
      success(res, await mfa.acknowledge(req.user, req.body, "rotate_ack")),
  );
  app.post("/api/auth/mfa/login/ack", authLimit, async (req, res) =>
    success(res, await mfa.acknowledge(null, req.body, "login_ack")),
  );
  app.delete("/api/auth/mfa", allow("admin"), authLimit, async (req, res) =>
    success(res, await mfa.disable(req.user, req.body)),
  );
  app.post("/api/auth/signup", authLimit, async (req, res) => {
    await accounts.register(req.body);
    success(res, {
      message:
        "Check your inbox for an activation link. If already registered, use resend verification.",
    });
  });
  app.post("/api/auth/resend", authLimit, async (req, res) => {
    await accounts.request(req.body, "verify");
    success(res, {
      message: "If eligible, a verification email has been sent.",
    });
  });
  app.post("/api/auth/forgot-password", authLimit, async (req, res) => {
    await accounts.request(req.body, "reset");
    success(res, { message: "If eligible, a reset email has been sent." });
  });
  app.post("/api/auth/verify-email", authLimit, async (req, res) =>
    success(res, await accounts.verify(req.body.token)),
  );
  app.post("/api/auth/reset-password", authLimit, async (req, res) => {
    await accounts.reset(req.body);
    success(res, { message: "Password changed. Sign in again." });
  });
  app.delete("/api/auth/logout", allow("admin", "chef"), (req, res) =>
    success(res, { user: null }),
  );
  app.patch("/api/chefs/:id/approval", allow("admin"), async (req, res) => {
    await accounts.decide(req.params.id, req.body.decision);
    success(res, { id: req.params.id, approvalStatus: req.body.decision });
  });
  app.use(
    "/api",
    createRoutes(
      createApiController({
        repo,
        auth: createAuthService(repo),
        catalog: createCatalogService(repo, { photos }),
        photos,
        recipes: createRecipeService(db),
        stock: createStockService(db),
      }),
    ),
  );
  app.use("/api", (req, res) =>
    failure(res, 404, "ENDPOINT_NOT_FOUND", "API endpoint not found."),
  );
  app.use(errorHandler);
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  app.use(express.static(dist));
  app.get("/{*path}", (req, res) => {
    if (!existsSync(dist + "index.html"))
      return res
        .status(503)
        .type("text")
        .send(
          "Build the React application with npm run build, or use the Vite development server.",
        );
    if (req.path.split("/").pop().includes(".")) return res.sendStatus(404);
    res.sendFile(dist + "index.html");
  });
  return app;
}

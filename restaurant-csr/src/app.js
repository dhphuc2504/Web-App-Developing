import express from "express";
import session from "express-session";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
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
export function createApp({ db, store, config, photoService }) {
  const app = express(),
    repo = createRepository(db),
    photos = photoService || createPhotoService(config);
  app.disable("x-powered-by");
  if (config.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
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
  app.use(
    "/api",
    session({
      name: "restaurant.csr.sid",
      secret: config.SESSION_SECRET,
      store,
      genid: randomUUID,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.NODE_ENV === "production",
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
  app.use("/api", loadUser(repo));
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

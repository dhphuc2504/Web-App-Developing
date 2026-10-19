import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { allow, csrf } from "../middleware/security.js";
import { failure } from "../lib/responses.js";
import { photoUpload } from "../middleware/photo-upload.js";
export function createRoutes(c) {
  const r = Router(),
    kitchen = allow("admin", "chef"),
    admin = allow("admin");
  r.get("/session", c.session);
  r.post(
    "/session",
    rateLimit({
      windowMs: 900000,
      limit: 10,
      skipSuccessfulRequests: true,
      requestWasSuccessful: (req, res) => res.locals.loginSucceeded === true,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (req, res) =>
        failure(
          res,
          200,
          "RATE_LIMITED",
          "Too many sign-in attempts. Try again later.",
        ),
    }),
    csrf,
    c.login,
  );
  r.delete("/session", kitchen, csrf, c.logout);
  r.get("/menu", c.menu);
  r.get("/menu/:slug", c.menuDish);
  r.post("/dish-photos", kitchen, csrf, photoUpload, c.uploadPhoto);
  for (const resource of ["dishes", "ingredients", "categories"]) {
    const write = resource === "dishes" ? kitchen : admin;
    r.get("/" + resource, kitchen, c.list(resource));
    r.get("/" + resource + "/:id", kitchen, c.detail(resource));
    r.post("/" + resource, write, csrf, c.save(resource));
    r.patch("/" + resource + "/:id", write, csrf, c.save(resource));
    r.delete("/" + resource + "/:id", write, csrf, c.archive(resource));
  }
  r.get("/dishes/:id/recipe", kitchen, c.recipe);
  r.put("/dishes/:id/recipe", kitchen, csrf, c.saveRecipe);
  r.get("/ingredients/:id/movements", kitchen, c.movements);
  r.get("/stock-operations", kitchen, c.stockList);
  r.post("/stock-operations", kitchen, csrf, c.stockCreate);
  r.get("/chefs", admin, c.chefs);
  r.get("/chefs/:id", admin, c.chef);
  r.post("/chefs", admin, csrf, c.createChef);
  r.patch("/chefs/:id", admin, csrf, c.updateChef);
  r.delete("/chefs/:id", admin, csrf, c.removeChef);
  return r;
}

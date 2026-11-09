import { Router } from "express";
import { allow } from "../middleware/security.js";
import { photoUpload } from "../middleware/photo-upload.js";
export function createRoutes(c) {
  const r = Router(),
    kitchen = allow("admin", "chef"),
    admin = allow("admin");
  r.get("/dishes", c.menu);
  r.get("/dishes/:id", c.publicDish);
  r.get("/menu", c.menu);
  r.get("/menu/:slug", c.menuDish);
  r.post("/dish-photos", kitchen, photoUpload, c.uploadPhoto);
  for (const resource of ["dishes", "ingredients", "categories"]) {
    const write = resource === "dishes" ? kitchen : admin;
    r.get(
      resource === "dishes" ? "/staff/dishes" : "/" + resource,
      kitchen,
      c.list(resource),
    );
    r.get(
      (resource === "dishes" ? "/staff/dishes" : "/" + resource) + "/:id",
      kitchen,
      c.detail(resource),
    );
    r.post("/" + resource, write, c.save(resource));
    r.patch("/" + resource + "/:id", write, c.save(resource));
    r.delete("/" + resource + "/:id", admin, c.archive(resource));
  }
  r.get("/dishes/:id/recipe", kitchen, c.recipe);
  r.put("/dishes/:id/recipe", kitchen, c.saveRecipe);
  r.get("/ingredients/:id/movements", kitchen, c.movements);
  r.get("/stock-operations", kitchen, c.stockList);
  r.post("/stock-operations", kitchen, c.stockCreate);
  r.get("/chefs", admin, c.chefs);
  r.get("/chefs/:id", admin, c.chef);
  r.post("/chefs", admin, c.createChef);
  r.patch("/chefs/:id", admin, c.updateChef);
  r.delete("/chefs/:id", admin, c.removeChef);
  r.delete("/chefs/:id/account", admin, c.deleteChef);
  return r;
}

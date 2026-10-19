import { http } from "./client.js";
const id = (value) => encodeURIComponent(value);
const collection = (name) => ({
  list: (signal) => http.request("/" + name, { signal }),
  get: (key, signal) => http.request(`/${name}/${id(key)}`, { signal }),
  create: (body) => http.request("/" + name, { method: "POST", body }),
  update: (key, body) =>
    http.request(`/${name}/${id(key)}`, { method: "PATCH", body }),
  archive: (key) => http.request(`/${name}/${id(key)}`, { method: "DELETE" }),
});
export const sessionApi = {
  get: (signal) => http.request("/session", { signal }),
  login: (body) => http.request("/session", { method: "POST", body }),
  logout: () => http.request("/session", { method: "DELETE" }),
};
export const menuApi = {
  list: (search, signal) =>
    http.request("/menu" + (search ? "?" + search : ""), { signal }),
  get: (slug, signal) => http.request("/menu/" + id(slug), { signal }),
};
export const dishesApi = collection("dishes"),
  ingredientsApi = collection("ingredients"),
  categoriesApi = collection("categories"),
  chefsApi = collection("chefs");
export const photosApi = {
  upload: (file) => {
    const body = new FormData();
    body.append("photo", file);
    return http.request("/dish-photos", {
      method: "POST",
      body,
      timeoutMs: 60000,
    });
  },
};
export const recipesApi = {
  get: (dishId, signal) =>
    http.request(`/dishes/${id(dishId)}/recipe`, { signal }),
  save: (dishId, body) =>
    http.request(`/dishes/${id(dishId)}/recipe`, { method: "PUT", body }),
};
export const stockApi = {
  list: (signal) => http.request("/stock-operations", { signal }),
  record: (body) => http.request("/stock-operations", { method: "POST", body }),
  ledger: (key, signal) =>
    http.request(`/ingredients/${id(key)}/movements`, { signal }),
};

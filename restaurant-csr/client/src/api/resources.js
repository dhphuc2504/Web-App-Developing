import { tokenStore } from "./token.js";
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
  get: (signal) =>
    tokenStore.get()
      ? http.request("/auth/me", { signal })
      : Promise.resolve({ user: null }),
  login: (body) =>
    http.request("/auth/login", {
      method: "POST",
      body,
      blockUI: false,
      timeoutMs: 45000,
    }),
  otp: (body) =>
    http.request("/auth/otp", { method: "POST", body, blockUI: false }),
  logout: async () => {
    try {
      await http.request("/auth/logout", { method: "DELETE" });
    } catch {
      /* Local logout still succeeds if the network is unavailable. */
    } finally {
      tokenStore.set(null);
    }
    return { user: null };
  },
};
export const accountApi = {
  config: (signal) =>
    http.request("/auth/config", { signal, background: true }),
  submit: (action, body) =>
    http.request("/auth/" + action, {
      method: "POST",
      body,
      blockUI: false,
      timeoutMs: 45000,
    }),
  approve: (id, decision) =>
    http.request("/chefs/" + encodeURIComponent(id) + "/approval", {
      method: "PATCH",
      body: { decision },
    }),
};
export const menuApi = {
  list: (search, signal) =>
    http.request("/menu" + (search ? "?" + search : ""), {
      signal,
      background: true,
    }),
  get: (slug, signal) => http.request("/menu/" + id(slug), { signal }),
};
export const dishesApi = {
    ...collection("dishes"),
    get: (key, signal) => http.request("/staff/dishes/" + id(key), { signal }),
    page: (search, signal) =>
      http.request("/staff/dishes?" + search, { signal, background: true }),
  },
  ingredientsApi = collection("ingredients"),
  categoriesApi = collection("categories"),
  chefsApi = {
    ...collection("chefs"),
    removeAccount: (key, email) =>
      http.request("/chefs/" + id(key) + "/account", {
        method: "DELETE",
        body: { email },
      }),
  };
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

export const mfaApi = {
  status: (signal) => http.request("/auth/mfa", { signal }),
  submit: (action, body) =>
    http.request("/auth/mfa" + (action === "disable" ? "" : "/" + action), {
      method: action === "disable" ? "DELETE" : "POST",
      body,
      blockUI: false,
      timeoutMs: 45000,
    }),
};

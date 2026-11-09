let memory = null;
const key = "restaurant.accessToken";
export const tokenStore = {
  get() {
    try {
      return sessionStorage.getItem(key) || memory;
    } catch {
      return memory;
    }
  },
  set(token) {
    memory = token || null;
    try {
      if (token) sessionStorage.setItem(key, token);
      else sessionStorage.removeItem(key);
    } catch {}
  },
};

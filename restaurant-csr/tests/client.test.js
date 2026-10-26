import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiClient } from "../client/src/api/client.js";
const response = (body, status = 200, type = "application/json") =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": type },
  });
test("client centralizes URL, JSON headers, CSRF and credentials", async () => {
  const calls = [],
    changes = [];
  const client = createApiClient({
    onPending: (n) => changes.push(n),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({
        ok: true,
        data: url.endsWith("/session")
          ? { csrfToken: "token" }
          : { id: "saved" },
      });
    },
  });
  const saved = await client.request("/dishes", {
    method: "POST",
    body: { name: "Rice" },
  });
  assert.equal(saved.id, "saved");
  assert.equal(calls[1].url, "/api/dishes");
  assert.equal(calls[1].options.headers["Content-Type"], "application/json");
  assert.equal(calls[1].options.headers["X-CSRF-Token"], "token");
  assert.equal(calls[1].options.credentials, "same-origin");
  assert.equal(
    changes.reduce((a, b) => a + b, 0),
    0,
  );
});
test("client distinguishes transport failures and always releases loading", async () => {
  let count = 0;
  const client = createApiClient({
    onPending: (n) => (count += n),
    fetchImpl: async () => {
      throw new TypeError("network");
    },
  });
  await assert.rejects(() => client.request("/menu"), {
    layer: "network",
    code: "NETWORK_ERROR",
  });
  assert.equal(count, 0);
});
test("client distinguishes HTTP failure from application failure", async () => {
  for (const [status, layer] of [
    [500, "http"],
    [200, "application"],
  ]) {
    const client = createApiClient({
      fetchImpl: async () =>
        response(
          {
            ok: false,
            error: {
              code: "EXAMPLE_CODE",
              message: "Can change",
              fields: { name: "Required" },
            },
          },
          status,
        ),
    });
    await assert.rejects(() => client.request("/menu"), {
      layer,
      code: "EXAMPLE_CODE",
      fields: { name: "Required" },
    });
  }
});
test("client rejects non-JSON and malformed envelope responses", async () => {
  for (const reply of [
    response("<html>broken</html>", 502, "text/html"),
    response({ data: [] }),
  ]) {
    const client = createApiClient({ fetchImpl: async () => reply });
    await assert.rejects(() => client.request("/menu"), {
      layer: "http",
      code: "INVALID_RESPONSE",
    });
  }
});
test("401 notifies auth state and cancellation is distinguishable", async () => {
  let loggedOut = false;
  const client = createApiClient({
    onUnauthorized: () => (loggedOut = true),
    fetchImpl: async () =>
      response(
        { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in" } },
        401,
      ),
  });
  await assert.rejects(() => client.request("/dishes"), {
    code: "UNAUTHENTICATED",
  });
  assert.equal(loggedOut, true);
  const controller = new AbortController();
  controller.abort();
  const cancelled = createApiClient({
    fetchImpl: async () => {
      throw new Error();
    },
  });
  await assert.rejects(
    () => cancelled.request("/menu", { signal: controller.signal }),
    { code: "CANCELLED" },
  );
});
test("photo multipart keeps browser boundary and shared CSRF handling", async () => {
  let sent;
  const client = createApiClient({
    fetchImpl: async (url, options) => {
      if (url.endsWith("/session"))
        return response({ ok: true, data: { csrfToken: "token" } });
      sent = options;
      return response({ ok: true, data: { imagePath: "/images/photo.webp" } });
    },
  });
  const body = new FormData();
  body.append("photo", new Blob(["test"], { type: "image/png" }), "dish.png");
  await client.request("/dish-photos", { method: "POST", body });
  assert.equal(sent.body, body);
  assert.equal(sent.headers["Content-Type"], undefined);
  assert.equal(sent.headers["X-CSRF-Token"], "token");
});

test("background browsing leaves global controls available, but mutations still block", async () => {
  const changes = [];
  const client = createApiClient({
    onPending: (n) => changes.push(n),
    fetchImpl: async () =>
      response({ ok: true, data: { csrfToken: "test-token" } }),
  });
  await client.request("/menu?q=temupra", { background: true });
  assert.deepEqual(changes, []);
  await client.request("/dishes/example", {
    method: "PATCH",
    body: { name: "Rice" },
    background: true,
  });
  assert.ok(changes.includes(1));
  assert.equal(
    changes.reduce((a, b) => a + b, 0),
    0,
  );
});

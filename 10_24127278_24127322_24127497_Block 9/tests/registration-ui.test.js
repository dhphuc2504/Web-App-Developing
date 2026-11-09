import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { allowedOrigins } from "../src/lib/origins.js";
import { createAccountDelivery } from "../src/services/account-delivery.js";
import { createCaptchaLoader } from "../client/src/api/captcha.js";
import { createApiClient } from "../client/src/api/client.js";
const base = {
  NODE_ENV: "development",
  APP_ORIGIN: "http://127.0.0.1:3000/",
  JWT_SECRET: "test-only-".repeat(8),
};
test("development accepts localhost and 127.0.0.1 only on configured scheme/port", async () => {
  const app = createApp({ db: {}, config: base });
  for (const origin of ["http://127.0.0.1:3000", "http://localhost:3000"]) {
    const response = await request(app)
      .get("/api/auth/config")
      .set("Origin", origin);
    assert.equal(response.status, 200);
    assert.equal(response.headers["access-control-allow-origin"], origin);
    assert.equal(
      response.headers["access-control-allow-credentials"],
      undefined,
    );
  }
  for (const origin of [
    "http://localhost:3002",
    "https://localhost:3000",
    "http://localhost.evil.test:3000",
    "null",
  ])
    assert.equal(
      (await request(app).get("/api/auth/config").set("Origin", origin)).status,
      403,
    );
  assert.deepEqual(
    [...allowedOrigins({ ...base, NODE_ENV: "production" })],
    ["http://127.0.0.1:3000"],
  );
});
test("CAPTCHA hostname verification follows the same bounded local-origin policy", async () => {
  for (const [mode, hostname, accepted] of [
    ["development", "localhost", true],
    ["production", "localhost", false],
    ["development", "evil.test", false],
  ]) {
    const service = createAccountDelivery(
      {
        ...base,
        NODE_ENV: mode,
        RECAPTCHA_SITE_KEY: "test",
        RECAPTCHA_SECRET_KEY: "test",
      },
      {
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ success: true, hostname }),
        }),
      },
    );
    if (accepted) await service.captcha("test-token");
    else
      await assert.rejects(() => service.captcha("test-token"), {
        status: 422,
      });
  }
});
function fixture() {
  const scripts = [],
    win = {};
  const doc = {
    head: { append: (s) => scripts.push(s) },
    createElement: () => ({
      dataset: {},
      events: {},
      addEventListener(name, fn) {
        this.events[name] = fn;
      },
      remove() {
        this.removed = true;
      },
    }),
  };
  return {
    scripts,
    win,
    doc,
    ready(script) {
      win.grecaptcha = { render() {} };
      win[new URL(script.src).searchParams.get("onload")]();
    },
  };
}
test("CAPTCHA waits for Google dependencies-ready callback and shares concurrent loads", async () => {
  const f = fixture(),
    load = createCaptchaLoader(f.win, f.doc, 1000),
    first = load();
  assert.equal(first, load());
  assert.equal(f.scripts.length, 1);
  let settled = false;
  first.then(() => {
    settled = true;
  });
  f.scripts[0].events.load?.();
  await Promise.resolve();
  assert.equal(settled, false);
  f.ready(f.scripts[0]);
  assert.equal(await first, f.win.grecaptcha);
  assert.equal(await load(), f.win.grecaptcha);
  assert.equal(f.scripts.length, 1);
});
test("blocked or stalled CAPTCHA fails visibly and can retry", async () => {
  const f = fixture(),
    load = createCaptchaLoader(f.win, f.doc, 20);
  const first = load();
  f.scripts[0].events.error();
  await assert.rejects(first, /blocked/);
  assert.equal(f.scripts[0].removed, true);
  const second = load();
  assert.equal(f.scripts.length, 2);
  await assert.rejects(second, /could not load/);
  const third = load();
  f.ready(f.scripts[2]);
  await third;
});
test("auth request keeps global navigation responsive and returns timeout errors", async () => {
  const changes = [];
  const client = createApiClient({
    onPending: (n) => changes.push(n),
    fetchImpl: async () => {
      throw new DOMException("Timed out", "TimeoutError");
    },
  });
  await assert.rejects(
    () =>
      client.request("/auth/signup", {
        method: "POST",
        body: {},
        blockUI: false,
      }),
    { code: "TIMEOUT" },
  );
  assert.deepEqual(changes, []);
});
test("stalled SMTP delivery has a total deadline and closes the connection", async () => {
  let closed = false;
  const delivery = createAccountDelivery(
    {
      ...base,
      SMTP_HOST: "mock",
      SMTP_USER: "mock",
      SMTP_PASSWORD: "mock",
      SMTP_FROM: "mock@example.test",
    },
    {
      sendTimeoutMs: 10,
      transportFactory: () => ({
        sendMail: () => new Promise(() => {}),
        close: () => {
          closed = true;
        },
      }),
    },
  );
  await assert.rejects(
    () =>
      delivery.send({
        email: "mock@example.test",
        purpose: "verify",
        token: "test",
      }),
    { status: 503 },
  );
  assert.equal(closed, true);
});

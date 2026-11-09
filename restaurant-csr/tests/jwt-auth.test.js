import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { SignJWT } from "jose";
import { testDatabase } from "./database.js";
import { createApp } from "../src/app.js";
import { createJwtService } from "../src/services/jwt-service.js";
import { createAuthService } from "../src/services/auth-service.js";
import { createRepository } from "../src/models/repository.js";
import { createLoginService } from "../src/services/login-service.js";
const config = {
  NODE_ENV: "test",
  JWT_SECRET: "isolated-test-jwt-secret-".repeat(3),
  APP_ORIGIN: "http://localhost:3000",
};
const password = "Only-for-isolated-tests-2026";
let fixture, db, admin, chef, other, category, dish;
const mails = [];
const delivery = {
  captcha: async (token) => {
    if (token !== "test-captcha") throw new Error("Invalid mock CAPTCHA");
  },
  send: async (mail) => {
    mails.push(mail);
  },
};
const app = () => createApp({ db, config, delivery });
const bearer = async (user) =>
  "Bearer " + (await createJwtService(config).issue(user));
before(async () => {
  fixture = await testDatabase();
  db = fixture.db;
  const auth = createAuthService(createRepository(db));
  admin = await auth.createInitialAdmin({
    email: "admin@example.test",
    displayName: "Admin",
    password,
  });
  chef = await auth.createChef({
    email: "chef@example.test",
    displayName: "Chef",
    password,
  });
  other = await auth.createChef({
    email: "other@example.test",
    displayName: "Other",
    password,
  });
  chef = await db.staffUser.update({
    where: { id: chef.id },
    data: { emailVerifiedAt: new Date() },
  });
  category = await db.category.create({
    data: { name: "Mains", slug: "mains", isActive: true },
  });
  dish = await db.dish.create({
    data: {
      name: "Owned dish",
      slug: "owned-dish",
      categoryId: category.id,
      chefId: chef.id,
      priceMinor: 100n,
      isPublished: true,
    },
  });
});
after(async () => fixture?.close());
test("email OTP is required, bounded, single-use; JWT verification performs zero DB reads", async () => {
  const api = app();
  const first = await request(api)
    .post("/api/auth/login")
    .send({ email: chef.email, password });
  assert.equal(first.body.data.next, "mfa");
  assert.equal(first.body.data.accessToken, undefined);
  assert.equal(first.headers["set-cookie"], undefined);
  const code = mails.at(-1).token,
    challenge = first.body.data.challenge;
  const wrong = await request(api)
    .post("/api/auth/otp")
    .send({ challenge, code: code === "000000" ? "000001" : "000000" });
  assert.equal(wrong.body.error.code, "INVALID_OTP");
  const ok = await request(api).post("/api/auth/otp").send({ challenge, code });
  assert.equal(ok.body.ok, true);
  assert.ok(ok.body.data.accessToken);
  assert.equal(ok.headers["set-cookie"], undefined);
  assert.equal(
    (await request(api).post("/api/auth/otp").send({ challenge, code })).body
      .error.code,
    "INVALID_OTP",
  );
  const original = db.staffUser.findUnique,
    tx = db.$transaction;
  db.staffUser.findUnique = () => {
    throw new Error("Forbidden DB lookup during JWT verification");
  };
  db.$transaction = () => {
    throw new Error("Forbidden transaction during JWT verification");
  };
  try {
    const me = await request(api)
      .get("/api/auth/me")
      .set("Authorization", "Bearer " + ok.body.data.accessToken);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.id, chef.id);
  } finally {
    db.staffUser.findUnique = original;
    db.$transaction = tx;
  }
});
test("registration uses email link; verification is single-use and approval gates login", async () => {
  const api = app(),
    email = "applicant@example.test";
  const registered = await request(api).post("/api/auth/signup").send({
    email,
    displayName: "Applicant",
    password,
    confirmPassword: password,
    "g-recaptcha-response": "test-captcha",
    role: "admin",
  });
  assert.equal(registered.body.ok, true);
  const user = await db.staffUser.findUnique({ where: { email } });
  assert.equal(user.role, "chef");
  assert.equal(user.approvalStatus, "pending");
  let response = await request(api)
    .post("/api/auth/login")
    .send({ email, password });
  assert.equal(response.body.error.code, "ACCOUNT_NOT_ACTIVATED");
  const token = mails.find(
    (m) => m.email === email && m.purpose === "verify",
  ).token;
  response = await request(api).post("/api/auth/verify-email").send({ token });
  assert.equal(response.body.ok, true);
  assert.equal(
    (await request(api).post("/api/auth/verify-email").send({ token })).body.ok,
    false,
  );
  assert.equal(
    (await request(api).post("/api/auth/login").send({ email, password })).body
      .error.code,
    "APPROVAL_REQUIRED",
  );
  response = await request(api)
    .patch("/api/chefs/" + user.id + "/approval")
    .set("Authorization", await bearer(admin))
    .send({ decision: "approved" });
  assert.equal(response.body.ok, true);
  response = await request(api)
    .post("/api/auth/login")
    .send({ email, password });
  assert.equal(response.body.data.next, "mfa");
});
test("five wrong OTPs exhaust the challenge; expired OTP never issues JWT", async () => {
  await db.loginChallenge.deleteMany({ where: { userId: admin.id } });
  const login = createLoginService(
    db,
    delivery,
    createJwtService(config),
    config,
  );
  const result = await login.login({ email: admin.email, password });
  const code = mails.at(-1).token;
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      () =>
        login.verify({
          challenge: result.challenge,
          code: code === "000000" ? "000001" : "000000",
        }),
      { code: "INVALID_OTP" },
    );
  await assert.rejects(
    () => login.verify({ challenge: result.challenge, code }),
    { code: "INVALID_OTP" },
  );
  await db.loginChallenge.deleteMany({ where: { userId: admin.id } });
  const second = await login.login({ email: admin.email, password });
  await db.loginChallenge.updateMany({
    where: { userId: admin.id },
    data: { expiresAt: new Date(0) },
  });
  await assert.rejects(
    () =>
      login.verify({ challenge: second.challenge, code: mails.at(-1).token }),
    { code: "INVALID_OTP" },
  );
});
test("forged, expired and wrong-purpose JWTs return 401; 403 does not revoke valid JWT", async () => {
  const api = app();
  const expired = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(admin.id)
    .setIssuer("santaishi-tei")
    .setAudience("restaurant-csr")
    .setIssuedAt()
    .setExpirationTime(1)
    .sign(new TextEncoder().encode(config.JWT_SECRET));
  for (const token of ["fake", expired, (await bearer(admin)).slice(7) + "x"])
    assert.equal(
      (
        await request(api)
          .get("/api/auth/me")
          .set("Authorization", "Bearer " + token)
      ).status,
      401,
    );
  const authorization = await bearer(chef);
  assert.equal(
    (await request(api).get("/api/chefs").set("Authorization", authorization))
      .status,
    403,
  );
  assert.equal(
    (await request(api).get("/api/auth/me").set("Authorization", authorization))
      .status,
    200,
  );
});
test("ownership from stored dish governs edits; only admins publish/archive/assign", async () => {
  const api = app(),
    owner = await bearer(chef),
    outsider = await bearer(other),
    manager = await bearer(admin),
    path = "/api/dishes/" + dish.id;
  assert.equal(
    (
      await request(api)
        .patch(path)
        .set("Authorization", owner)
        .send({ name: "Chef edit while published" })
    ).body.ok,
    true,
  );
  assert.equal(
    (await db.dish.findUnique({ where: { id: dish.id } })).isPublished,
    true,
  );
  for (const body of [
    { name: "Intrusion" },
    { chefId: other.id, name: "Intrusion" },
    { role: "admin" },
  ])
    assert.equal(
      (await request(api).patch(path).set("Authorization", outsider).send(body))
        .body.ok,
      false,
    );
  assert.equal(
    (
      await request(api)
        .patch(path)
        .set("Authorization", owner)
        .send({ isPublished: false })
    ).status,
    403,
  );
  assert.equal(
    (await request(api).delete(path).set("Authorization", owner)).status,
    403,
  );
  assert.equal(
    (
      await request(api)
        .put(path + "/recipe")
        .set("Authorization", outsider)
        .send({ version: 0, instructions: "No", items: [] })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(api)
        .patch(path)
        .set("Authorization", manager)
        .send({ chefId: other.id })
    ).body.ok,
    true,
  );
  assert.equal(
    (
      await request(api)
        .patch(path)
        .set("Authorization", owner)
        .send({ name: "No longer owner" })
    ).status,
    403,
  );
  const created = await request(api)
    .post("/api/dishes")
    .set("Authorization", owner)
    .send({ name: "My new draft", categoryId: category.id, priceMinor: "10" });
  assert.equal(created.body.data.chefId, chef.id);
  assert.equal(created.body.data.isPublished, false);
  assert.equal(
    (await request(api).get("/api/dishes/" + created.body.data.id)).body.ok,
    false,
  );
  assert.equal(
    (await request(api).get("/api/dishes/" + dish.id)).body.ok,
    true,
  );
  assert.equal(
    (await request(api).delete(path).set("Authorization", manager)).body.ok,
    true,
  );
});
test("password reset invalidates pending challenges but documents existing JWT validity", async () => {
  const api = app(),
    token = await bearer(chef);
  await request(api)
    .post("/api/auth/forgot-password")
    .send({ email: chef.email });
  const reset = mails.at(-1).token;
  const result = await request(api)
    .post("/api/auth/reset-password")
    .send({
      token: reset,
      password: password + "new",
      confirmPassword: password + "new",
    });
  assert.equal(result.body.ok, true);
  assert.equal(
    (
      await request(api)
        .post("/api/auth/reset-password")
        .send({ token: reset, password, confirmPassword: password })
    ).body.ok,
    false,
  );
  assert.equal(
    (await request(api).get("/api/auth/me").set("Authorization", token)).status,
    200,
  );
  assert.equal(
    await db.loginChallenge.count({ where: { userId: chef.id, usedAt: null } }),
    0,
  );
});
test("persistent account counter blocks repeated failures and CORS allows only configured origin", async () => {
  const api = app();
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await request(api)
          .post("/api/auth/login")
          .send({ email: "unknown@example.test", password })
      ).body.error.code,
      "INVALID_CREDENTIALS",
    );
  assert.equal(
    (
      await request(api)
        .post("/api/auth/login")
        .send({ email: "unknown@example.test", password })
    ).body.error.code,
    "RATE_LIMITED",
  );
  assert.equal(
    (
      await request(api)
        .options("/api/auth/login")
        .set("Origin", "https://evil.example")
    ).status,
    403,
  );
  const allowed = await request(api)
    .options("/api/auth/login")
    .set("Origin", config.APP_ORIGIN);
  assert.equal(allowed.status, 204);
  assert.match(
    allowed.headers["access-control-allow-headers"],
    /Authorization/,
  );
  assert.equal(allowed.headers["access-control-allow-credentials"], undefined);
});

test("permanent chef deletion is admin-only, requires email confirmation and frees email without deleting dishes", async () => {
  const api = app(),
    auth = createAuthService(createRepository(db));
  const target = await auth.createChef({
    email: "delete-test@example.test",
    displayName: "Disposable",
    password,
  });
  const owned = await db.dish.create({
    data: {
      name: "Preserved dish",
      slug: "preserved-dish",
      categoryId: category.id,
      chefId: target.id,
      priceMinor: 10n,
    },
  });
  await db.authToken.create({
    data: {
      userId: target.id,
      purpose: "verify",
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  const path = "/api/chefs/" + target.id + "/account";
  assert.equal(
    (await request(api).delete(path).send({ email: target.email })).status,
    401,
  );
  assert.equal(
    (
      await request(api)
        .delete(path)
        .set("Authorization", await bearer(chef))
        .send({ email: target.email })
    ).status,
    403,
  );
  const manager = await bearer(admin);
  assert.equal(
    (
      await request(api)
        .delete(path)
        .set("Authorization", manager)
        .send({ email: "wrong@example.test" })
    ).body.error.code,
    "CONFIRMATION_REQUIRED",
  );
  const deleted = await request(api)
    .delete(path)
    .set("Authorization", manager)
    .send({ email: target.email });
  assert.equal(deleted.body.data.deleted, true);
  assert.equal(
    await db.staffUser.findUnique({ where: { id: target.id } }),
    null,
  );
  assert.equal(await db.authToken.count({ where: { userId: target.id } }), 0);
  assert.equal(
    (await db.dish.findUnique({ where: { id: owned.id } })).chefId,
    null,
  );
  const reused = await auth.createChef({
    email: target.email,
    displayName: "Reused email",
    password,
  });
  assert.notEqual(reused.id, target.id);
  assert.equal(
    (
      await request(api)
        .delete("/api/chefs/" + admin.id + "/account")
        .set("Authorization", manager)
        .send({ email: admin.email })
    ).body.error.code,
    "NOT_FOUND",
  );
});
test("permanent deletion refuses chef accounts referenced by recipes or immutable journals", async () => {
  const api = app(),
    manager = await bearer(admin);
  await db.recipe.create({
    data: {
      dishId: dish.id,
      updatedBy: chef.id,
      instructions: "Keep attribution",
    },
  });
  const result = await request(api)
    .delete("/api/chefs/" + chef.id + "/account")
    .set("Authorization", manager)
    .send({ email: chef.email });
  assert.equal(result.body.error.code, "CHEF_HAS_HISTORY");
  assert.ok(await db.staffUser.findUnique({ where: { id: chef.id } }));
  const auth = createAuthService(createRepository(db)),
    journalChef = await auth.createChef({
      email: "journal-owner@example.test",
      displayName: "Journal owner",
      password,
    });
  await db.stockOperation.create({
    data: {
      type: "waste",
      reason: "Preserve attribution",
      createdBy: journalChef.id,
      requestKey: "11111111-1111-4111-8111-111111111111",
    },
  });
  assert.equal(
    (
      await request(api)
        .delete("/api/chefs/" + journalChef.id + "/account")
        .set("Authorization", manager)
        .send({ email: journalChef.email })
    ).body.error.code,
    "CHEF_HAS_HISTORY",
  );
});

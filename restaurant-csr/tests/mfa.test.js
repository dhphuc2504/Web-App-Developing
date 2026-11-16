import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import request from "supertest";
import { generate } from "otplib";
import { testDatabase } from "./database.js";
import { createMfaService } from "../src/services/mfa-service.js";
import { createLoginService } from "../src/services/login-service.js";
import { createJwtService } from "../src/services/jwt-service.js";
import { createApp } from "../src/app.js";

const config = {
  NODE_ENV: "test",
  JWT_SECRET: "isolated-jwt-secret-".repeat(3),
  MFA_ENCRYPTION_KEY: "ab".repeat(32),
  APP_ORIGIN: "http://localhost:3000",
};
const password = "Isolated-MFA-password-2026";
let fixture,
  db,
  passwordHash,
  counter = 0;
before(async () => {
  fixture = await testDatabase();
  db = fixture.db;
  passwordHash = await argon2.hash(password);
});
after(async () => fixture?.close());
const errorIs = (code) => (e) => e.code === code;
async function context(role = "admin") {
  const user = await db.staffUser.create({
    data: {
      email: `mfa${++counter}@example.test`,
      displayName: "MFA test",
      passwordHash,
      role,
      isActive: true,
      approvalStatus: "approved",
      emailVerifiedAt: new Date(),
    },
  });
  let now = Date.now();
  const emails = [],
    delivery = { send: async (mail) => emails.push(mail) },
    jwt = createJwtService(config);
  const service = createMfaService(db, delivery, jwt, config, {
    now: () => now,
  });
  return {
    user,
    service,
    emails,
    delivery,
    jwt,
    advance: (ms = 30000) => (now += ms),
    code: (secret) => generate({ secret, epoch: Math.floor(now / 1000) }),
  };
}
async function enroll(ctx) {
  const { service, user, emails } = ctx;
  const start = await service.startSetup(user, { password });
  const setup = await service.verifySetupEmail(user, {
    challenge: start.challenge,
    code: emails.at(-1).token,
  });
  const codes = await service.confirmSetup(user, {
    challenge: setup.challenge,
    code: await ctx.code(setup.manualKey),
  });
  await service.acknowledge(
    user,
    { challenge: codes.challenge, saved: true },
    "setup_ack",
  );
  ctx.user = await db.staffUser.findUnique({ where: { id: user.id } });
  return { ...setup, ...codes };
}
test("enrollment requires password + email + TOTP + saved recovery codes; secrets are encrypted and codes hashed", async () => {
  const ctx = await context(),
    { service, user, emails } = ctx;
  await assert.rejects(
    service.startSetup(user, { password: "wrong" }),
    errorIs("INVALID_MFA_CODE"),
  );
  const start = await service.startSetup(user, { password });
  assert.equal(emails.at(-1).purpose, "mfa-setup");
  const wrong = emails.at(-1).token === "000000" ? "000001" : "000000";
  await assert.rejects(
    service.verifySetupEmail(user, { challenge: start.challenge, code: wrong }),
    errorIs("INVALID_MFA_CODE"),
  );
  const setup = await service.verifySetupEmail(user, {
    challenge: start.challenge,
    code: emails.at(-1).token,
  });
  assert.match(setup.qrCode, /^data:image\/png;base64,/);
  assert.match(setup.manualKey, /^[A-Z2-7]+$/);
  await assert.rejects(
    service.verifySetupEmail(user, {
      challenge: start.challenge,
      code: emails.at(-1).token,
    }),
    errorIs("MFA_CHALLENGE_EXPIRED"),
  );
  const codes = await service.confirmSetup(user, {
    challenge: setup.challenge,
    code: await ctx.code(setup.manualKey),
  });
  assert.equal(codes.recoveryCodes.length, 10);
  assert.equal(await service.enabled(user.id), false);
  await assert.rejects(
    service.acknowledge(
      user,
      { challenge: codes.challenge, saved: false },
      "setup_ack",
    ),
    errorIs("RECOVERY_CODES_REQUIRED"),
  );
  await service.acknowledge(
    user,
    { challenge: codes.challenge, saved: true },
    "setup_ack",
  );
  assert.deepEqual(await service.status(user), {
    enabled: true,
    recoveryCodesRemaining: 10,
  });
  const state = await db.adminMfa.findUnique({ where: { userId: user.id } });
  assert.notEqual(state.secret, setup.manualKey);
  assert.ok(!state.secret.includes(setup.manualKey));
  const rows = await db.mfaRecoveryCode.findMany({
    where: { userId: user.id },
  });
  assert.ok(rows.every((r) => r.hash.startsWith("$argon2id$")));
  assert.ok(!JSON.stringify(rows).includes(codes.recoveryCodes[0]));
  assert.ok(
    !JSON.stringify(
      await db.mfaChallenge.findMany({ where: { userId: user.id } }),
    ).includes(setup.manualKey),
  );
});
test("fourth failure locks the account for 30 seconds across challenges; lock does not extend; reused time steps fail", async () => {
  const ctx = await context(),
    setup = await enroll(ctx),
    { service } = ctx;
  const login = await service.startLogin(ctx.user);
  // The setup code's time step has already been consumed.
  const replay = await ctx.code(setup.manualKey);
  for (let i = 0; i < 3; i++)
    await assert.rejects(
      service.verifyLogin({ challenge: login.challenge, code: replay }),
      errorIs("INVALID_MFA_CODE"),
    );
  await assert.rejects(
    service.verifyLogin({ challenge: login.challenge, code: replay }),
    errorIs("MFA_LOCKED"),
  );
  const before = await db.adminMfa.findUnique({
    where: { userId: ctx.user.id },
  });
  ctx.advance(20000);
  await assert.rejects(service.startLogin(ctx.user), errorIs("MFA_LOCKED"));
  await assert.rejects(
    service.verifyLogin({
      challenge: login.challenge,
      code: await ctx.code(setup.manualKey),
    }),
    errorIs("MFA_LOCKED"),
  );
  assert.deepEqual(
    (await db.adminMfa.findUnique({ where: { userId: ctx.user.id } }))
      .lockedUntil,
    before.lockedUntil,
  );
  ctx.advance(10001);
  const body = {
    challenge: login.challenge,
    code: await ctx.code(setup.manualKey),
  };
  const results = await Promise.allSettled([
    service.verifyLogin(body),
    service.verifyLogin(body),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const result = results.find((r) => r.status === "fulfilled").value;
  assert.ok(result.accessToken);
  assert.equal((await ctx.jwt.verify(result.accessToken)).id, ctx.user.id);
  const next = await service.startLogin(ctx.user);
  await assert.rejects(
    service.verifyLogin({ challenge: next.challenge, code: body.code }),
    errorIs("INVALID_MFA_CODE"),
  );
});
test("recovery codes are one-use; using the last requires saving replacements before JWT issuance", async () => {
  const ctx = await context(),
    setup = await enroll(ctx),
    { service } = ctx;
  for (let i = 0; i < 10; i++) {
    const login = await service.startLogin(ctx.user);
    const result = await service.verifyLogin({
      challenge: login.challenge,
      method: "recovery",
      code: setup.recoveryCodes[i],
    });
    if (i < 9) assert.ok(result.accessToken);
    else {
      assert.equal(result.accessToken, undefined);
      assert.equal(result.next, "recovery-codes");
      await assert.rejects(
        service.acknowledge(
          null,
          { challenge: result.challenge, saved: false },
          "login_ack",
        ),
        errorIs("RECOVERY_CODES_REQUIRED"),
      );
      const final = await service.acknowledge(
        null,
        { challenge: result.challenge, saved: true },
        "login_ack",
      );
      assert.ok(final.accessToken);
      assert.equal((await service.status(ctx.user)).recoveryCodesRemaining, 10);
      ctx.user = await db.staffUser.findUnique({ where: { id: ctx.user.id } });
    }
    if (i === 0) {
      const retry = await service.startLogin(ctx.user);
      await assert.rejects(
        service.verifyLogin({
          challenge: retry.challenge,
          method: "recovery",
          code: setup.recoveryCodes[0],
        }),
        errorIs("INVALID_MFA_CODE"),
      );
    }
  }
});
test("password plus a fresh factor protects rotation and disable; disabling restores admin email OTP", async () => {
  const ctx = await context(),
    setup = await enroll(ctx),
    { service, delivery, jwt } = ctx;
  ctx.advance();
  const code = await ctx.code(setup.manualKey);
  await assert.rejects(
    service.disable(ctx.user, { password: "wrong", code }),
    errorIs("INVALID_MFA_CODE"),
  );
  const rotated = await service.regenerate(ctx.user, { password, code });
  await service.acknowledge(
    ctx.user,
    { challenge: rotated.challenge, saved: true },
    "rotate_ack",
  );
  ctx.user = await db.staffUser.findUnique({ where: { id: ctx.user.id } });
  const login = await service.startLogin(ctx.user);
  await assert.rejects(
    service.verifyLogin({
      challenge: login.challenge,
      method: "recovery",
      code: setup.recoveryCodes[0],
    }),
    errorIs("INVALID_MFA_CODE"),
  );
  await service.disable(ctx.user, {
    password,
    method: "recovery",
    code: rotated.recoveryCodes[0],
  });
  assert.equal((await service.status(ctx.user)).enabled, false);
  assert.equal(
    await db.mfaRecoveryCode.count({ where: { userId: ctx.user.id } }),
    0,
  );
  assert.equal(
    (await db.adminMfa.findUnique({ where: { userId: ctx.user.id } })).secret,
    null,
  );
  const result = await createLoginService(db, delivery, jwt, config).login({
    email: ctx.user.email,
    password,
  });
  assert.equal(result.method, "email");
});
test("TOTP admin login sends no email; chef and unenrolled admin continue using email OTP", async () => {
  const ctx = await context();
  await enroll(ctx);
  const count = ctx.emails.length;
  const login = createLoginService(db, ctx.delivery, ctx.jwt, config);
  const result = await login.login({ email: ctx.user.email, password });
  assert.equal(result.method, "totp");
  assert.equal(ctx.emails.length, count);
  assert.equal(result.accessToken, undefined);
  for (const role of ["chef", "admin"]) {
    const other = await context(role);
    const email = await createLoginService(
      db,
      other.delivery,
      other.jwt,
      config,
    ).login({ email: other.user.email, password });
    assert.equal(email.method, "email");
    const final = await createLoginService(
      db,
      other.delivery,
      other.jwt,
      config,
    ).verify({ challenge: email.challenge, code: other.emails.at(-1).token });
    assert.ok(final.accessToken);
  }
});
test("setup challenges are bound to their purpose and owner; expiry and password reset invalidate them", async () => {
  const ctx = await context(),
    other = await context(),
    { service, user } = ctx;
  const start = await service.startSetup(user, { password });
  await assert.rejects(
    service.verifySetupEmail(other.user, {
      challenge: start.challenge,
      code: ctx.emails.at(-1).token,
    }),
    errorIs("MFA_CHALLENGE_EXPIRED"),
  );
  await assert.rejects(
    service.verifyLogin({
      challenge: start.challenge,
      code: ctx.emails.at(-1).token,
    }),
    errorIs("MFA_CHALLENGE_EXPIRED"),
  );
  ctx.advance(300001);
  await assert.rejects(
    service.verifySetupEmail(user, {
      challenge: start.challenge,
      code: ctx.emails.at(-1).token,
    }),
    errorIs("MFA_CHALLENGE_EXPIRED"),
  );
  const fresh = await service.startSetup(user, { password });
  await db.staffUser.update({
    where: { id: user.id },
    data: { sessionVersion: { increment: 1 } },
  });
  await assert.rejects(
    service.verifySetupEmail(user, {
      challenge: fresh.challenge,
      code: ctx.emails.at(-1).token,
    }),
    errorIs("MFA_CHALLENGE_EXPIRED"),
  );
});
test("MFA endpoints require admin role and current active account; never set cookies or expose saved secrets", async () => {
  const ctx = await context(),
    chef = await context("chef");
  await enroll(ctx);
  const app = createApp({ db, config, delivery: ctx.delivery });
  assert.equal((await request(app).get("/api/auth/mfa")).status, 401);
  assert.equal(
    (
      await request(app)
        .get("/api/auth/mfa")
        .set("Authorization", "Bearer " + (await ctx.jwt.issue(chef.user)))
    ).status,
    403,
  );
  const token = await ctx.jwt.issue(ctx.user);
  const status = await request(app)
    .get("/api/auth/mfa")
    .set("Authorization", "Bearer " + token);
  assert.deepEqual(status.body.data, {
    enabled: true,
    recoveryCodesRemaining: 10,
  });
  assert.equal(status.headers["set-cookie"], undefined);
  await db.staffUser.update({
    where: { id: ctx.user.id },
    data: { isActive: false },
  });
  assert.equal(
    (
      await request(app)
        .get("/api/auth/mfa")
        .set("Authorization", "Bearer " + token)
    ).status,
    403,
  );
});

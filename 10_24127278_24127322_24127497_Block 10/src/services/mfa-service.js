import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import argon2 from "argon2";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { AppError } from "../lib/errors.js";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const invalid = () =>
  new AppError(
    200,
    "Invalid, expired or already-used code. Use a fresh code.",
    "INVALID_MFA_CODE",
  );
const expired = () =>
  new AppError(
    200,
    "This verification step expired. Please start again.",
    "MFA_CHALLENGE_EXPIRED",
  );
const locked = () =>
  new AppError(
    200,
    "Too many incorrect attempts. Wait 30 seconds before trying again.",
    "MFA_LOCKED",
  );
const eligible = (user) =>
  user?.role === "admin" &&
  user.isActive &&
  user.emailVerifiedAt &&
  user.approvalStatus === "approved";

export function createMfaService(
  db,
  delivery,
  jwt,
  config,
  { now = () => Date.now() } = {},
) {
  const date = () => new Date(now());
  function encryptionKey() {
    if (!/^[a-f0-9]{64}$/i.test(config.MFA_ENCRYPTION_KEY || ""))
      throw new AppError(
        500,
        "Authenticator configuration is unavailable. Contact the administrator.",
        "MFA_CONFIGURATION_ERROR",
      );
    return Buffer.from(config.MFA_ENCRYPTION_KEY, "hex");
  }
  function encrypt(secret, userId) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    cipher.setAAD(Buffer.from(userId));
    const ciphertext = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), ciphertext]
      .map((b) => b.toString("base64"))
      .join(".");
  }
  function decrypt(value, userId) {
    const [iv, tag, ciphertext] = value
      .split(".")
      .map((v) => Buffer.from(v, "base64"));
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    cipher.setAAD(Buffer.from(userId));
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString(
      "utf8",
    );
  }
  const emailHash = (challenge, code) =>
    createHmac("sha256", config.JWT_SECRET)
      .update(challenge + ":" + code)
      .digest("hex");
  async function issue(tx, user, purpose, payload = {}, lifetime = 300000) {
    const challenge = randomBytes(32).toString("hex");
    await tx.mfaChallenge.create({
      data: {
        userId: user.id,
        tokenHash: digest(challenge),
        purpose,
        version: user.sessionVersion,
        payload,
        expiresAt: new Date(now() + lifetime),
      },
    });
    return challenge;
  }
  // Every operation locks the same user row, including failed attempts and replay checks.
  // Return errors from the transaction, then throw, so failed counters are committed.
  async function transaction(userId, operation) {
    const result = await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM restaurant.staff_users WHERE id=${userId}::uuid FOR UPDATE`;
        const user = await tx.staffUser.findUnique({ where: { id: userId } });
        if (!eligible(user))
          return {
            error: new AppError(
              403,
              "An active, approved administrator account is required.",
              "FORBIDDEN",
            ),
          };
        let state = await tx.adminMfa.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
        if (state.lockedUntil && state.lockedUntil > date())
          return { error: locked() };
        if (state.lockedUntil)
          state = await tx.adminMfa.update({
            where: { userId },
            data: { lockedUntil: null, failures: 0 },
          });
        const fail = async () => {
          const failures = state.failures + 1;
          await tx.adminMfa.update({
            where: { userId },
            data: {
              failures,
              lockedUntil: failures >= 4 ? new Date(now() + 30000) : null,
            },
          });
          return { error: failures >= 4 ? locked() : invalid() };
        };
        return operation(tx, user, state, fail);
      },
      { timeout: 15000 },
    );
    if (result?.error) throw result.error;
    return result;
  }
  async function challengeTransaction(body, purpose, actor, operation) {
    if (
      typeof body?.challenge !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.challenge)
    )
      throw expired();
    const row = await db.mfaChallenge.findUnique({
      where: { tokenHash: digest(body.challenge) },
    });
    if (!row || row.purpose !== purpose || (actor && actor.id !== row.userId))
      throw expired();
    return transaction(row.userId, async (tx, user, state, fail) => {
      const current = await tx.mfaChallenge.findUnique({
        where: { id: row.id },
      });
      if (
        !current ||
        current.usedAt ||
        current.expiresAt <= date() ||
        current.version !== user.sessionVersion
      )
        return { error: expired() };
      return operation(tx, user, state, fail, current);
    });
  }
  const consume = (tx, row) =>
    tx.mfaChallenge.update({ where: { id: row.id }, data: { usedAt: date() } });
  const clearFailures = (tx, user) =>
    tx.adminMfa.update({
      where: { userId: user.id },
      data: { failures: 0, lockedUntil: null },
    });
  async function passwordMatches(user, password) {
    return (
      typeof password === "string" &&
      password.length <= 256 &&
      (await argon2.verify(user.passwordHash, password))
    );
  }
  async function proof(tx, user, state, body) {
    if (!state.enabled) return false;
    if (body.method === "recovery") {
      if (
        typeof body.code !== "string" ||
        !/^[a-f0-9]{8}-[a-f0-9]{32}$/.test(body.code)
      )
        return false;
      const row = await tx.mfaRecoveryCode.findUnique({
        where: { id: body.code.split("-")[0] },
      });
      if (
        !row ||
        row.userId !== user.id ||
        row.usedAt ||
        !(await argon2.verify(row.hash, body.code))
      )
        return false;
      await tx.mfaRecoveryCode.update({
        where: { id: row.id },
        data: { usedAt: date() },
      });
      return true;
    }
    if (body.method && body.method !== "totp") return false;
    if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code))
      return false;
    const result = await verify({
      secret: decrypt(state.secret, user.id),
      token: body.code,
      epoch: Math.floor(now() / 1000),
      period: 30,
      digits: 6,
      epochTolerance: [30, 0],
      afterTimeStep: state.lastStep,
    });
    if (!result.valid) return false;
    await tx.adminMfa.update({
      where: { userId: user.id },
      data: { lastStep: result.timeStep },
    });
    return true;
  }
  async function newRecoveryCodes() {
    const codes = [],
      hashes = [];
    for (let i = 0; i < 10; i++) {
      const id = randomBytes(4).toString("hex"),
        code = id + "-" + randomBytes(16).toString("hex");
      codes.push(code);
      hashes.push({
        id,
        hash: await argon2.hash(code, {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }),
      });
    }
    return { codes, hashes };
  }
  async function recoveryStep(tx, user, purpose, payload = {}) {
    const { codes, hashes } = await newRecoveryCodes();
    // Newest pending acknowledgement wins. Active codes remain until acknowledgement.
    await tx.mfaChallenge.updateMany({
      where: { userId: user.id, purpose, usedAt: null },
      data: { usedAt: date() },
    });
    const challenge = await issue(
      tx,
      user,
      purpose,
      { ...payload, hashes },
      600000,
    );
    return {
      next: "recovery-codes",
      challenge,
      recoveryCodes: codes,
      expiresIn: 600,
    };
  }
  async function finishLogin(user) {
    return {
      accessToken: await jwt.issue(user),
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }
  async function loginSuccess(tx, user) {
    await tx.staffUser.update({
      where: { id: user.id },
      data: { lastLoginAt: date() },
    });
    await tx.failedAttempt.deleteMany({ where: { key: digest(user.email) } });
    return { loginUser: user };
  }
  async function invalidate(tx, user) {
    await tx.staffUser.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });
    await tx.loginChallenge.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: date() },
    });
    await tx.mfaChallenge.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: date() },
    });
  }
  return {
    async enabled(userId) {
      return Boolean(
        (await db.adminMfa.findUnique({ where: { userId } }))?.enabled,
      );
    },
    async status(actor) {
      // Settings read current account state; JWT signature verification still never reads DB.
      const user = await db.staffUser.findUnique({ where: { id: actor.id } });
      if (!eligible(user))
        throw new AppError(403, "Administrator access required.", "FORBIDDEN");
      const state = await db.adminMfa.findUnique({
        where: { userId: actor.id },
      });
      return {
        enabled: Boolean(state?.enabled),
        recoveryCodesRemaining: await db.mfaRecoveryCode.count({
          where: { userId: actor.id, usedAt: null },
        }),
      };
    },
    async startLogin(user) {
      return transaction(user.id, async (tx, current, state) => {
        if (!state.enabled || current.sessionVersion !== user.sessionVersion)
          return { error: expired() };
        await tx.mfaChallenge.updateMany({
          where: { userId: user.id, purpose: "login", usedAt: null },
          data: { usedAt: date() },
        });
        return {
          next: "mfa",
          method: "totp",
          challenge: await issue(tx, current, "login"),
          expiresIn: 300,
        };
      });
    },
    async verifyLogin(body) {
      const result = await challengeTransaction(
        body,
        "login",
        null,
        async (tx, user, state, fail, row) => {
          if (!(await proof(tx, user, state, body))) return fail();
          await consume(tx, row);
          await clearFailures(tx, user);
          if (
            !(await tx.mfaRecoveryCode.count({
              where: { userId: user.id, usedAt: null },
            }))
          )
            return recoveryStep(tx, user, "login_ack");
          return loginSuccess(tx, user);
        },
      );
      return result.loginUser ? finishLogin(result.loginUser) : result;
    },
    async startSetup(actor, body = {}) {
      encryptionKey();
      const result = await transaction(
        actor.id,
        async (tx, user, state, fail) => {
          if (state.enabled)
            return {
              error: new AppError(
                200,
                "Disable the current authenticator before setting up another.",
                "MFA_ALREADY_ENABLED",
              ),
            };
          if (!(await passwordMatches(user, body.password))) return fail();
          const recent = await tx.mfaChallenge.findFirst({
            where: {
              userId: user.id,
              purpose: "setup_email",
              createdAt: { gt: new Date(now() - 60000) },
            },
          });
          if (recent)
            return {
              error: new AppError(
                200,
                "Wait one minute before requesting another email.",
                "OTP_COOLDOWN",
              ),
            };
          await tx.mfaChallenge.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: date() },
          });
          const challenge = randomBytes(32).toString("hex"),
            code = String(randomInt(1000000)).padStart(6, "0");
          await tx.mfaChallenge.create({
            data: {
              userId: user.id,
              purpose: "setup_email",
              tokenHash: digest(challenge),
              version: user.sessionVersion,
              payload: { hash: emailHash(challenge, code) },
              expiresAt: new Date(now() + 300000),
            },
          });
          return { challenge, code, email: user.email };
        },
      );
      try {
        await delivery.send({
          email: result.email,
          purpose: "mfa-setup",
          token: result.code,
        });
      } catch (error) {
        await db.mfaChallenge.deleteMany({
          where: { tokenHash: digest(result.challenge) },
        });
        throw error;
      }
      return { next: "email", challenge: result.challenge, expiresIn: 300 };
    },
    async verifySetupEmail(actor, body) {
      const result = await challengeTransaction(
        body,
        "setup_email",
        actor,
        async (tx, user, state, fail, row) => {
          if (state.enabled) return { error: expired() };
          if (
            typeof body.code !== "string" ||
            !/^\d{6}$/.test(body.code) ||
            !timingSafeEqual(
              Buffer.from(row.payload.hash),
              Buffer.from(emailHash(body.challenge, body.code)),
            )
          )
            return fail();
          await consume(tx, row);
          await clearFailures(tx, user);
          const secret = generateSecret();
          const challenge = await issue(
            tx,
            user,
            "setup_confirm",
            { secret: encrypt(secret, user.id) },
            600000,
          );
          return { secret, email: user.email, challenge };
        },
      );
      const uri = generateURI({
        issuer: "Santaishi-tei",
        label: result.email,
        secret: result.secret,
        period: 30,
        digits: 6,
      });
      return {
        next: "authenticator",
        challenge: result.challenge,
        manualKey: result.secret,
        qrCode: await QRCode.toDataURL(uri),
        expiresIn: 600,
      };
    },
    async confirmSetup(actor, body) {
      return challengeTransaction(
        body,
        "setup_confirm",
        actor,
        async (tx, user, state, fail, row) => {
          if (state.enabled) return { error: expired() };
          if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code))
            return fail();
          const result = await verify({
            secret: decrypt(row.payload.secret, user.id),
            token: body.code,
            epoch: Math.floor(now() / 1000),
            period: 30,
            digits: 6,
            epochTolerance: [30, 0],
          });
          if (!result.valid) return fail();
          await consume(tx, row);
          await clearFailures(tx, user);
          return recoveryStep(tx, user, "setup_ack", {
            secret: row.payload.secret,
            lastStep: result.timeStep,
          });
        },
      );
    },
    async acknowledge(actor, body, purpose) {
      if (body?.saved !== true)
        throw new AppError(
          200,
          "Save your recovery codes before continuing.",
          "RECOVERY_CODES_REQUIRED",
        );
      const result = await challengeTransaction(
        body,
        purpose,
        actor,
        async (tx, user, state, fail, row) => {
          if ((purpose === "setup_ack") === state.enabled)
            return { error: expired() };
          await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
          await tx.mfaRecoveryCode.createMany({
            data: row.payload.hashes.map((r) => ({ ...r, userId: user.id })),
          });
          if (purpose === "setup_ack")
            await tx.adminMfa.update({
              where: { userId: user.id },
              data: {
                secret: row.payload.secret,
                enabled: true,
                lastStep: row.payload.lastStep,
              },
            });
          await clearFailures(tx, user);
          await invalidate(tx, user);
          if (purpose === "login_ack") return loginSuccess(tx, user);
          return { enabled: true, recoveryCodesRemaining: 10 };
        },
      );
      return result.loginUser ? finishLogin(result.loginUser) : result;
    },
    async regenerate(actor, body = {}) {
      return transaction(actor.id, async (tx, user, state, fail) => {
        if (
          !(await passwordMatches(user, body.password)) ||
          !(await proof(tx, user, state, body))
        )
          return fail();
        await clearFailures(tx, user);
        return recoveryStep(tx, user, "rotate_ack");
      });
    },
    async disable(actor, body = {}) {
      return transaction(actor.id, async (tx, user, state, fail) => {
        if (
          !(await passwordMatches(user, body.password)) ||
          !(await proof(tx, user, state, body))
        )
          return fail();
        await tx.adminMfa.update({
          where: { userId: user.id },
          data: {
            enabled: false,
            secret: null,
            lastStep: -1,
            failures: 0,
            lockedUntil: null,
          },
        });
        await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
        await invalidate(tx, user);
        return { enabled: false, recoveryCodesRemaining: 0 };
      });
    },
  };
}

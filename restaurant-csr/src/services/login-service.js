import { createMfaService } from "./mfa-service.js";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import argon2 from "argon2";
import { loginInput } from "../validators/input.js";
import { AppError } from "../lib/errors.js";
const digest = (s) => createHash("sha256").update(s).digest("hex");
export function createLoginService(db, delivery, jwt, config) {
  const mfa = createMfaService(db, delivery, jwt, config);
  const codeHash = (challenge, code) =>
    createHmac("sha256", config.JWT_SECRET)
      .update(challenge + ":" + code)
      .digest("hex");
  const eligible = (user) => {
    if (!user?.isActive)
      throw new AppError(
        200,
        "Invalid email or password.",
        "INVALID_CREDENTIALS",
      );
    if (!user.emailVerifiedAt)
      throw new AppError(
        200,
        "Verify your email before signing in.",
        "ACCOUNT_NOT_ACTIVATED",
      );
    if (user.approvalStatus !== "approved")
      throw new AppError(
        200,
        "Administrator approval is required.",
        "APPROVAL_REQUIRED",
      );
  };
  return {
    async login(body) {
      const input = loginInput.parse(body),
        key = digest(input.email);
      // Reserve attempts atomically so concurrent requests cannot bypass the limit.
      const allowed = await db.$transaction(async (tx) => {
        await tx.$executeRaw`INSERT INTO restaurant.failed_attempts (key,count,expires_at) VALUES (${key},1,NOW()+INTERVAL '15 minutes') ON CONFLICT (key) DO UPDATE SET count=CASE WHEN restaurant.failed_attempts.expires_at<=NOW() THEN 1 ELSE restaurant.failed_attempts.count+1 END, expires_at=CASE WHEN restaurant.failed_attempts.expires_at<=NOW() THEN NOW()+INTERVAL '15 minutes' ELSE restaurant.failed_attempts.expires_at END`;
        return (
          (await tx.failedAttempt.findUnique({ where: { key } })).count <= 10
        );
      });
      if (!allowed)
        throw new AppError(
          200,
          "Too many attempts. Try again after 15 minutes.",
          "RATE_LIMITED",
        );
      const user = await db.staffUser.findUnique({
        where: { email: input.email },
      });
      if (!user || !(await argon2.verify(user.passwordHash, input.password)))
        throw new AppError(
          200,
          "Invalid email or password.",
          "INVALID_CREDENTIALS",
        );
      eligible(user);
      if (user.role === "admin" && (await mfa.enabled(user.id)))
        return mfa.startLogin(user);
      const challenge = randomBytes(32).toString("hex"),
        code = String(randomInt(1000000)).padStart(6, "0");
      const created = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM restaurant.staff_users WHERE id=${user.id}::uuid FOR UPDATE`;
        const recent = await tx.loginChallenge.findFirst({
          where: {
            userId: user.id,
            createdAt: { gt: new Date(Date.now() - 60000) },
          },
        });
        if (recent)
          throw new AppError(
            200,
            "Wait one minute before requesting another code.",
            "OTP_COOLDOWN",
          );
        await tx.loginChallenge.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        return tx.loginChallenge.create({
          data: {
            userId: user.id,
            tokenHash: digest(challenge),
            codeHash: codeHash(challenge, code),
            sessionVersion: user.sessionVersion,
            expiresAt: new Date(Date.now() + 300000),
          },
        });
      });
      try {
        await delivery.send({
          email: user.email,
          purpose: "login",
          token: code,
        });
      } catch (error) {
        await db.loginChallenge.deleteMany({ where: { id: created.id } });
        throw error;
      }
      return { next: "mfa", method: "email", challenge, expiresIn: 300 };
    },
    async verify(body = {}) {
      if (
        typeof body?.challenge === "string" &&
        /^[a-f0-9]{64}$/.test(body.challenge)
      ) {
        const challenge = await db.mfaChallenge.findUnique({
          where: { tokenHash: digest(body.challenge) },
        });
        if (challenge) return mfa.verifyLogin(body);
      }
      if (
        typeof body.challenge !== "string" ||
        !/^[a-f0-9]{64}$/.test(body.challenge) ||
        typeof body.code !== "string" ||
        !/^\d{6}$/.test(body.code)
      )
        throw new AppError(
          200,
          "Enter the six-digit email code.",
          "INVALID_OTP",
        );
      const result = await db.$transaction(async (tx) => {
        const row = await tx.loginChallenge.findUnique({
          where: { tokenHash: digest(body.challenge) },
        });
        if (!row) return null;
        await tx.$queryRaw`SELECT id FROM restaurant.staff_users WHERE id=${row.userId}::uuid FOR UPDATE`;
        const current = await tx.loginChallenge.findUnique({
          where: { id: row.id },
        });
        if (
          current.usedAt ||
          current.attempts >= 5 ||
          current.expiresAt <= new Date()
        )
          return null;
        await tx.loginChallenge.update({
          where: { id: row.id },
          data: { attempts: { increment: 1 } },
        });
        if (
          !timingSafeEqual(
            Buffer.from(current.codeHash),
            Buffer.from(codeHash(body.challenge, body.code)),
          )
        )
          return null;
        const user = await tx.staffUser.findUnique({
          where: { id: row.userId },
        });
        eligible(user);
        if (user.sessionVersion !== current.sessionVersion) return null;
        if (
          user.role === "admin" &&
          (await tx.adminMfa.findUnique({ where: { userId: user.id } }))
            ?.enabled
        )
          return null;
        await tx.loginChallenge.update({
          where: { id: row.id },
          data: { usedAt: new Date() },
        });
        await tx.staffUser.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await tx.failedAttempt.deleteMany({
          where: { key: digest(user.email) },
        });
        return user;
      });
      if (!result)
        throw new AppError(
          200,
          "Invalid or expired code. After five attempts, sign in again to request a new code.",
          "INVALID_OTP",
        );
      return {
        accessToken: await jwt.issue(result),
        expiresIn: 900,
        user: {
          id: result.id,
          email: result.email,
          displayName: result.displayName,
          role: result.role,
          isActive: result.isActive,
        },
      };
    },
  };
}

import argon2 from "argon2";
import { staffInput } from "../validators/input.js";
import { AppError } from "../lib/errors.js";
export function createAuthService(repo) {
  return {
    async createInitialAdmin(body) {
      const data = staffInput.parse(body);
      const passwordHash = await argon2.hash(data.password, {
        type: argon2.argon2id,
      });
      return repo.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(72183012)`;
        if (await tx.staffUser.count({ where: { role: "admin" } }))
          throw new AppError(409, "The initial admin already exists.");
        return tx.staffUser.create({
          data: {
            email: data.email,
            displayName: data.displayName,
            passwordHash,
            role: "admin",
            emailVerifiedAt: new Date(),
            approvalStatus: "approved",
          },
        });
      });
    },
    async createChef(body) {
      const data = staffInput.parse(body);
      return repo.db.staffUser.create({
        data: {
          email: data.email,
          displayName: data.displayName,
          passwordHash: await argon2.hash(data.password, {
            type: argon2.argon2id,
          }),
          role: "chef",
          approvalStatus: "approved",
        },
      });
    },
  };
}

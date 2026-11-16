import { SignJWT, jwtVerify } from "jose";
import { AppError } from "../lib/errors.js";
export function createJwtService(config) {
  const secret = config.JWT_SECRET;
  if (typeof secret !== "string" || secret.length < 32)
    throw new Error("Configure JWT_SECRET with at least 32 random characters.");
  const key = new TextEncoder().encode(secret);
  const issuer = "santaishi-tei",
    audience = "restaurant-csr";
  return {
    async issue(user) {
      return new SignJWT({
        role: user.role,
        displayName: user.displayName,
        email: user.email,
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(user.id)
        .setIssuedAt()
        .setIssuer(issuer)
        .setAudience(audience)
        .setExpirationTime("15m")
        .sign(key);
    },
    async verify(token) {
      try {
        const { payload, protectedHeader } = await jwtVerify(token, key, {
          algorithms: ["HS256"],
          issuer,
          audience,
          requiredClaims: ["sub", "exp", "iat"],
          maxTokenAge: "15m",
        });
        if (
          protectedHeader.typ !== "JWT" ||
          !["admin", "chef"].includes(payload.role) ||
          !/^[a-f0-9-]{36}$/i.test(payload.sub)
        )
          throw new Error();
        return {
          id: payload.sub,
          role: payload.role,
          displayName: payload.displayName,
          email: payload.email,
          isActive: true,
        };
      } catch {
        throw new AppError(401, "Please sign in again.", "INVALID_TOKEN");
      }
    },
  };
}

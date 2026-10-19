import { randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "../lib/errors.js";
export const ensureCsrf = (req) =>
  (req.session.csrf ||= randomBytes(32).toString("hex"));
export function csrf(req, res, next) {
  const expected = req.session.csrf,
    provided = req.get("X-CSRF-Token");
  if (
    !expected ||
    typeof provided !== "string" ||
    !/^[a-f0-9]{64}$/.test(provided) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
  )
    throw new AppError(
      403,
      "Your form token expired. Refresh the page and try again.",
      "CSRF_INVALID",
    );
  next();
}
export function loadUser(repo) {
  return async (req, res, next) => {
    req.user = null;
    if (req.session.userId) {
      const user = await repo.staff.byId(req.session.userId);
      if (user?.isActive)
        req.user = {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        };
      else delete req.session.userId;
    }
    next();
  };
}
export function allow(...roles) {
  return (req, res, next) => {
    if (!req.user) throw new AppError(401, "Please sign in.");
    if (!roles.includes(req.user.role))
      throw new AppError(403, "You do not have permission for this action.");
    next();
  };
}

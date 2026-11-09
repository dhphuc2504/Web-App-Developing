import { AppError } from "../lib/errors.js";
// Token verification is deliberately independent of repositories/database clients.
export function loadUser(jwt) {
  return async (req, res, next) => {
    req.user = null;
    const header = req.get("Authorization");
    if (header) {
      if (!/^Bearer [^ ]+$/.test(header))
        throw new AppError(
          401,
          "Invalid authorization header.",
          "INVALID_TOKEN",
        );
      req.user = await jwt.verify(header.slice(7));
    }
    next();
  };
}
export function allow(...roles) {
  return (req, res, next) => {
    if (!req.user) throw new AppError(401, "Please sign in.", "AUTH_REQUIRED");
    if (!roles.includes(req.user.role))
      throw new AppError(
        403,
        "You do not have permission for this action.",
        "FORBIDDEN",
      );
    next();
  };
}
export function canEditDish(actor, dish) {
  if (!actor || (actor.role !== "admin" && dish.chefId !== actor.id))
    throw new AppError(
      403,
      "Only the assigned chef or an administrator can edit this dish.",
      "DISH_ACCESS_DENIED",
    );
}

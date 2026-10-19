import { AppError } from "./errors.js";
// DTOs explicitly select public fields; this serializer also prevents accidental secret output.
const forbidden = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "sessionSecret",
  "connectionString",
]);
export const serializable = (value) =>
  JSON.parse(
    JSON.stringify(value, (key, item) =>
      forbidden.has(key)
        ? undefined
        : typeof item === "bigint"
          ? item.toString()
          : item,
    ),
  );
export const success = (res, data) =>
  res.status(200).json({ ok: true, data: serializable(data) });
export function failure(res, status, code, message, fields) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      ...(fields && Object.keys(fields).length ? { fields } : {}),
    },
  });
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof AppError)
    return failure(
      res,
      [401, 403].includes(error.status) ? error.status : 200,
      error.code,
      error.message,
      error.fields,
    );
  if (error?.name === "ZodError") {
    const fields = {};
    for (const issue of error.issues) {
      if (issue.path.length) fields[issue.path.join(".")] ||= issue.message;
    }
    return failure(
      res,
      200,
      "VALIDATION_ERROR",
      "Please check the submitted fields.",
      fields,
    );
  }
  if (error?.type === "entity.parse.failed")
    return failure(
      res,
      200,
      "INVALID_JSON",
      "The request body must contain valid JSON.",
    );
  if (error?.type === "entity.too.large")
    return failure(
      res,
      200,
      "PAYLOAD_TOO_LARGE",
      "The request body is too large.",
    );
  if (error?.code === "P2002")
    return failure(res, 200, "DUPLICATE_VALUE", "That value already exists.");
  if (error?.code === "P2025")
    return failure(res, 200, "NOT_FOUND", "Record not found.");
  if (error?.code === "P2003")
    return failure(
      res,
      200,
      "INVALID_REFERENCE",
      "A referenced record is unavailable.",
    );
  return failure(
    res,
    500,
    "INTERNAL_ERROR",
    "The request could not be completed. Please try again.",
  );
}

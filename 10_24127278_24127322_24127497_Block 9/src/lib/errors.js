export class AppError extends Error {
  constructor(status, message, code, fields) {
    super(message);
    this.status = status;
    this.code =
      code ||
      {
        401: "UNAUTHENTICATED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
      }[status] ||
      "INVALID_REQUEST";
    this.fields = fields;
  }
}

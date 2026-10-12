export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function publicError(error) {
  if (error instanceof AppError) return error;
  if (error?.name === 'ZodError') return new AppError(422, error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  if ([400,413].includes(error?.status)) return new AppError(error.status, error.status===413?'The submitted form is too large.':'The request is malformed.');
  if (error?.code === 'P2002') return new AppError(409, 'That value already exists. Please choose another.');
  if (error?.code === 'P2025') return new AppError(404, 'Record not found.');
  return new AppError(503, 'The operation could not be completed. Please try again.');
}

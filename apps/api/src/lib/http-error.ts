export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "internal_error",
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

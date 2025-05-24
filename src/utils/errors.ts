export class LettermintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class HttpRequestError extends LettermintError {
  public readonly statusCode: number;
  public readonly responseBody?: unknown;

  constructor(message: string, statusCode: number, responseBody?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class TimeoutError extends LettermintError {}

export class ValidationError extends HttpRequestError {
  public readonly errorType: string;

  constructor(message: string, errorType: string, responseBody?: unknown) {
    super(message, 422, responseBody);
    this.errorType = errorType;
  }
}

export class ClientError extends HttpRequestError {
  constructor(message: string, responseBody?: unknown) {
    super(message, 400, responseBody);
  }
}

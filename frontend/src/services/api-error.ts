import type { AxiosError } from "axios";

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number, public readonly detail?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

const defaultMessages: Record<number, string> = {
  400: "The submitted information is invalid.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource was not found.",
  409: "This request conflicts with existing data.",
  500: "The server encountered an error. Please try again later.",
};

export function toApiError(error: AxiosError<{ detail?: unknown; message?: string }>): ApiError {
  const status = error.response?.status;
  const detail = error.response?.data?.detail ?? error.response?.data?.message;
  const message = typeof detail === "string" ? detail : defaultMessages[status ?? 0] ?? "Unable to connect to the server. Please try again.";
  return new ApiError(message, status, detail);
}

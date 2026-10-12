import { parseApiErrorBody } from "@platform/validation";
import { ApiError, NetworkError } from "./errors";

interface RequestOptions {
  method: "GET" | "POST";
  body?: unknown;
  cookie?: string;
}

export function apiOrigin(): string {
  return process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001";
}

export async function apiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const server = options.cookie !== undefined;
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (options.method !== "GET") {
    headers.set("x-requested-with", "fetch");
  }
  if (server) {
    headers.set("cookie", options.cookie ?? "");
  }

  let response: Response;
  try {
    response = await fetch(server ? `${apiOrigin()}${path}` : path, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: server ? "omit" : "include",
      cache: "no-store",
    });
  } catch {
    throw new NetworkError();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return (await response.json()) as T;
}

export function apiGet<T>(path: string, cookie?: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET", cookie });
}

export function apiPost<T>(path: string, body?: unknown, cookie?: string): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body, cookie });
}

export async function apiForm<T>(path: string, body: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "x-requested-with": "fetch" },
      body,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new NetworkError();
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = "REQUEST_FAILED";
  try {
    const payload: unknown = await response.json();
    code = parseApiErrorBody(payload).error.code;
  } catch {
    code = "REQUEST_FAILED";
  }
  return new ApiError(response.status, code);
}

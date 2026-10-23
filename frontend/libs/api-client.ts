import { API_BASE_URL } from "./env";
import { getToken } from "./auth-storage";

// A normalized API error so the UI can render a consistent message and react to
// auth failures (e.g. force a re-login on 401).
export class ApiError extends Error {
  readonly status: number;
  // True when the error was raised client-side without reaching the server
  // (e.g. a protected call attempted with no stored token). Such a 401 is a
  // local precondition failure, not the server rejecting the session, so
  // callers that force a re-login on 401 should ignore it.
  readonly local: boolean;
  constructor(status: number, message: string, options?: { local?: boolean }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.local = options?.local ?? false;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  // When true, attaches the stored bearer token (default for protected calls).
  auth?: boolean;
  body?: unknown;
  // query params appended to the URL, skipping null/undefined values.
  params?: Record<string, string | undefined | null>;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

export async function apiFetch<T>(
  path: string,
  { auth = true, body, params, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const finalHeaders = new Headers(headers);
  if (body !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getToken();
    // A protected call with no stored token is unauthorized by definition — fail
    // fast locally instead of sending a tokenless request the server will 401.
    // This avoids the confusing "no Authorization header" 401 that appears when
    // the session is cleared mid-flight (e.g. logout triggered by another call).
    if (!token) {
      throw new ApiError(401, "Not authenticated: no session token.", {
        local: true,
      });
    }
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), {
      ...init,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Unable to reach the server. Is the backend running?");
  }

  if (!res.ok) {
    throw new ApiError(res.status, await extractErrorMessage(res));
  }

  // 204 / empty body safety.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.message === "string") return data.message;
  } catch {
    // fall through to a status-based message
  }
  if (res.status === 401) return "Invalid credentials or session expired.";
  return `Request failed with status ${res.status}`;
}

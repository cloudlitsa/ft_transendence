// One place for all backend calls. Every request:
//   - hits /api/* (Vite proxies these to the backend container)
//   - sends cookies (credentials: "include") so the auth cookie travels with it
//   - parses JSON and throws on error responses, so callers can use try/catch

// The shape of an error response from our backend. Our endpoints send
// { error: "message" } and sometimes { error, details } on validation failures.
export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "include", // send/receive the httpOnly auth cookie
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Try to parse a JSON body even on errors (our backend sends { error: "..." }).
  // Some responses (like 204 No Content) have no body — that's fine, we ignore it.
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body — leave body as null
  }

  // If the HTTP status is not 2xx, throw with the backend's error message
  // so the calling code can catch it and show it to the user.
  if (!res.ok) {
    const message = (body as ApiError)?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body as T;
}

// The public API surface. Callers use api.get(...) and api.post(...).
export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),

  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
};

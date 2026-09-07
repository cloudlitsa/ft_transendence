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
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  // Don't set a JSON content-type for FormData — the browser must set its own
  // multipart boundary header for file uploads.
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "include", // send/receive the httpOnly auth cookie
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

  // 'delete' is a reserved-ish word people avoid as a bare identifier;
  // as an object property it's fine.
  
  delete: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    }),  
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  // For file uploads: pass a FormData; the browser sets the multipart header.
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }),
};

// ---------- Uploads that report progress ----------
//
// fetch() cannot tell you how far an upload has got. It hands back a promise
// that settles when the request is over, with nothing in between. Fine for a
// 40KB avatar; wrong for a 5MB photo on a slow connection, where a UI that
// shows nothing for twenty seconds looks broken.
//
// XMLHttpRequest is the older API and the only one in the browser that emits
// events while the body is still being sent. So chat uploads go through here;
// everything else keeps using request() above.
//
// The error contract is deliberately identical — it throws an Error carrying
// the backend's { error } message — so callers catch it the same way.
export function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);

    // The XHR equivalent of fetch's credentials: "include" — without it the
    // auth cookie is not sent and the backend answers 401.
    xhr.withCredentials = true;

    // `xhr.upload`, NOT `xhr`. Progress events on xhr itself describe the
    // download of the response, which here is a few hundred bytes of JSON.
    // lengthComputable is false when the total size isn't known; there is
    // nothing sensible to show in that case, so it is skipped.
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    // "load" fires for every completed response, including 4xx and 5xx —
    // unlike fetch, a non-2xx status is not an error to XHR either. The
    // status check below is what turns it into a rejection.
    xhr.addEventListener("load", () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // no JSON body — leave body as null
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
      } else {
        reject(new Error((body as ApiError)?.error || `Request failed (${xhr.status})`));
      }
    });

    // "error" is a transport failure — no response at all. A 415 from the
    // server is not this; it arrives as "load" with a status.
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    // No setRequestHeader("Content-Type") on purpose. The browser has to set
    // it itself, because multipart needs a boundary string in the header that
    // matches the one separating the parts in the body — and only the browser
    // knows what it generated.
    xhr.send(formData);
  });
}

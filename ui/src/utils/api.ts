import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiError {
  name: 'ApiError';
  status: number;
  message: string;
  body?: unknown;
}

export function createApiError(status: number, message: string, body?: unknown): ApiError {
  return { name: 'ApiError', status, message, body };
}

export function isApiError(err: unknown): err is ApiError {
  return typeof err === 'object' && err !== null && (err as any).name === 'ApiError';
}

// ── Core Fetch Wrapper ────────────────────────────────────────────────────────

export const apiFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { silent?: boolean }  // set silent=true to suppress automatic toasts
): Promise<Response> => {
  const token = localStorage.getItem('gateway_token');
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;

  try {
    response = await fetch(input, { ...init, headers });
  } catch {
    // Network / DNS failure
    if (!options?.silent) {
      toast.error('Connection Error', {
        description: 'Unable to communicate with the Gateway.',
      });
    }
    throw createApiError(0, 'Network error');
  }

  // ── Global status handling ─────────────────────────────────────────────────

  if (response.status === 401) {
    // Let AuthContext handle the UX (toast + redirect)
    window.dispatchEvent(new Event('auth-expired'));
    return response;
  }

  if (response.status === 403) {
    if (!options?.silent) {
      toast.error('Permission Denied', {
        description: "You don't have permission to perform this action.",
      });
    }
    return response;
  }

  if (response.status === 404) {
    if (!options?.silent) {
      toast.error('Not Found', {
        description: 'The requested resource was not found.',
      });
    }
    return response;
  }

  if (response.status >= 500) {
    if (!options?.silent) {
      toast.error('Server Error', {
        description: 'An unexpected error occurred on the server.',
      });
    }
    return response;
  }

  return response;
};

// ── Convenience Helpers ───────────────────────────────────────────────────────

export const apiGet = async <T>(url: string): Promise<T> => {
  const res = await apiFetch(url);
  if (!res.ok) throw createApiError(res.status, `GET ${url} failed`);
  return res.json() as Promise<T>;
};

export const apiPost = async <T>(url: string, body: unknown): Promise<T> => {
  const res = await apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw createApiError(res.status, errorBody?.message ?? `POST ${url} failed`, errorBody);
  }
  return res.json() as Promise<T>;
};

export const apiPut = async <T>(url: string, body: unknown): Promise<T> => {
  const res = await apiFetch(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw createApiError(res.status, errorBody?.message ?? `PUT ${url} failed`, errorBody);
  }
  return res.json() as Promise<T>;
};

export const apiDelete = async <T>(url: string): Promise<T> => {
  const res = await apiFetch(url, { method: 'DELETE' });
  if (!res.ok) throw createApiError(res.status, `DELETE ${url} failed`);
  return res.json() as Promise<T>;
};


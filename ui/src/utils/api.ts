export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const token = localStorage.getItem('token');
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    // If we get a 401, the token is invalid or expired.
    // Dispatch an event to let the AuthContext handle navigation and toasts cleanly.
    window.dispatchEvent(new Event('auth-expired'));
  }

  return response;
};

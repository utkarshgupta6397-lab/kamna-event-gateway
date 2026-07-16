import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const TOKEN_KEY = 'gateway_token';
const REDIRECT_KEY = 'gateway_redirect_to';

// ── Helpers ──────────────────────────────────────────────────────────────────

function isTokenExpired(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(atob(payloadB64));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true; // treat malformed token as expired
  }
}

function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isTokenExpired(token)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (token: string) => void;
  logout: (reason?: 'manual' | 'expired' | 'unauthorized') => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading] = useState(false);
  const navigate = useNavigate();
  // Use a ref so logout callback is always fresh without re-creating effect deps
  const logoutRef = useRef<(reason?: 'manual' | 'expired' | 'unauthorized') => void>(undefined);

  const logout = useCallback((reason: 'manual' | 'expired' | 'unauthorized' = 'manual') => {
    // 1. Clear storage
    localStorage.removeItem(TOKEN_KEY);
    // 2. Update state
    setToken(null);
    // 3. Notify other tabs / the SSE hook via custom event
    window.dispatchEvent(new Event('auth-logout'));

    // 4. Show toast based on reason
    if (reason === 'expired') {
      toast.warning('Session Expired', {
        description: 'Your session has expired. Please login again.',
      });
    } else if (reason === 'unauthorized') {
      toast.error('Unauthorized', {
        description: 'Your account is no longer authenticated.',
      });
    } else {
      toast.success('Logged Out', {
        description: 'You have been logged out successfully.',
      });
    }

    // 5. Navigate to login with replace so back button never returns to dashboard
    navigate('/login', { replace: true });
  }, [navigate]);

  // Keep ref in sync so we can use it in effects without stale closure
  logoutRef.current = logout;

  const login = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);

    // Restore the originally requested URL, or fall back to events
    const redirectTo = sessionStorage.getItem(REDIRECT_KEY) || '/dashboard/events';
    sessionStorage.removeItem(REDIRECT_KEY);

    navigate(redirectTo, { replace: true });
  }, [navigate]);

  // Handle auth-expired events dispatched by the API client
  useEffect(() => {
    const handleExpired = () => logoutRef.current?.('expired');
    const handleUnauthorized = () => logoutRef.current?.('unauthorized');

    window.addEventListener('auth-expired', handleExpired);
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth-expired', handleExpired);
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
  }, []);

  // Periodically check if stored token has expired (every 60 seconds)
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      if (isTokenExpired(token)) {
        logoutRef.current?.('expired');
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [token]);



  const value: AuthContextType = {
    isAuthenticated: !!token,
    isLoading,
    token,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// Export helpers for other modules
export { TOKEN_KEY, REDIRECT_KEY, isTokenExpired, getStoredToken };

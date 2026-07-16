import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

// Re-exported so downstream consumers can import from one place
export { useAuth };

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // While we are resolving session (e.g. async token validation in future), show overlay
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Remember where the user was trying to go
    const target = location.pathname + location.search + location.hash;
    if (target !== '/login' && target !== '/') {
      sessionStorage.setItem('gateway_redirect_to', target);
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

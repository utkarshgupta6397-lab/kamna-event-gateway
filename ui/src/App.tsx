import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';

import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Deliveries from './pages/Deliveries';
import Destinations from './pages/Destinations';
import Settings from './pages/Settings';
import About from './pages/About';

const queryClient = new QueryClient();

// Helper to redirect logged-in users away from the login page
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="events" element={<Events />} />
              <Route path="deliveries" element={<Deliveries />} />
              <Route path="destinations" element={<Destinations />} />
              <Route path="settings" element={<Settings />} />
              <Route path="about" element={<About />} />
            </Route>

            {/* Fallback for old root routes hitting dashboard directly */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="bottom-right" theme="system" richColors />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

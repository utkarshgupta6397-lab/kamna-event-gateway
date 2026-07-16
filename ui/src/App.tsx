import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';

import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Deliveries from './pages/Deliveries';
import Destinations from './pages/Destinations';
import Communications from './pages/Communications';
import CommunicationDetails from './pages/CommunicationDetails';
import Settings from './pages/Settings';
import About from './pages/About';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            {/* Legacy root → login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="events" element={<Events />} />
              <Route path="deliveries" element={<Deliveries />} />
              <Route path="destinations" element={<Destinations />} />
              <Route path="communications" element={<Communications />} />
              <Route path="communications/:id" element={<CommunicationDetails />} />
              <Route path="settings" element={<Settings />} />
              <Route path="about" element={<About />} />
            </Route>

            {/* Catch-all → login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>

          <Toaster
            position="bottom-right"
            theme="dark"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgb(15 23 42)',   // slate-950
                border: '1px solid rgb(51 65 85)',  // slate-700
                color: 'rgb(226 232 240)',       // slate-200
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

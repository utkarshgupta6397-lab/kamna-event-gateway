import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Deliveries from './pages/Deliveries';
import Destinations from './pages/Destinations';
import Settings from './pages/Settings';
import About from './pages/About';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="events" element={<Events />} />
            <Route path="deliveries" element={<Deliveries />} />
            <Route path="destinations" element={<Destinations />} />
            <Route path="settings" element={<Settings />} />
            <Route path="about" element={<About />} />
          </Route>
        </Routes>
        <Toaster position="bottom-right" theme="system" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

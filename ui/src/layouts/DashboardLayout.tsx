import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { LayoutDashboard, Zap, Send, MapPin, Settings as SettingsIcon, Info, Moon, Sun, Menu, LogOut, MessageSquare, Activity, Key, Smartphone } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD/CTRL + K to open search or CMD/CTRL + 1-4 for navigation
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case '1': e.preventDefault(); navigate('/dashboard'); break;
          case '2': e.preventDefault(); navigate('/dashboard/events'); break;
          case '3': e.preventDefault(); navigate('/dashboard/deliveries'); break;
          case '4': e.preventDefault(); navigate('/dashboard/destinations'); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = () => {
    logout('manual');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Events', path: '/dashboard/events', icon: Zap },
    { name: 'Deliveries', path: '/dashboard/deliveries', icon: Send },
    { name: 'Communications', path: '/dashboard/communications', icon: MessageSquare },
    { name: 'WhatsApp Templates', path: '/dashboard/templates', icon: Smartphone },
    { name: 'Destinations', path: '/dashboard/destinations', icon: MapPin },
    { name: 'Settings', path: '/dashboard/settings', icon: SettingsIcon },
    { name: 'API Keys', path: '/dashboard/settings/api-keys', icon: Key },
    { name: 'Diagnostics', path: '/dashboard/settings/diagnostics', icon: Activity },
    { name: 'Webhook Inspector', path: '/dashboard/settings/diagnostics/webhooks', icon: Zap },
    { name: 'About', path: '/dashboard/about', icon: Info },
  ];

  return (
    <div className={cn("min-h-screen flex bg-background text-foreground", isDark && "dark")}>
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform lg:translate-x-0 lg:static",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center border-b px-6">
          <Zap className="mr-2 h-6 w-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">Kamna Gateway</span>
        </div>
        <nav className="flex flex-col gap-2 p-4">
          {navItems.map((item, index) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )
              }
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.name}
              </div>
              {index < 4 && (
                <kbd className="hidden lg:inline-flex items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>{index + 1}
                </kbd>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex flex-1 justify-end gap-2">
            <button
              onClick={handleLogout}
              className="rounded-md p-2 hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
              title="Log Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-md p-2 hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
              title="Toggle Theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-muted/40 relative flex flex-col">
          <ErrorBoundary
            key={location.pathname}
            fallbackRender={({ error, resetErrorBoundary }: { error: any, resetErrorBoundary: any }) => (
              <div className="p-8 max-w-3xl mx-auto mt-10 border rounded-lg bg-destructive/10 text-destructive">
                <h2 className="text-xl font-bold mb-4">Rendering Error</h2>
                <pre className="text-sm overflow-auto mb-4 p-4 bg-background rounded-md">
                  {error?.message || String(error)}
                  {'\n'}
                  {error.stack}
                </pre>
                <button onClick={resetErrorBoundary} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm">
                  Try Again
                </button>
              </div>
            )}
          >
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

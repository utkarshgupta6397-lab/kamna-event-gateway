import { useQuery } from '@tanstack/react-query';
import { Settings as SettingsIcon, Server, Database, Code, Activity, Terminal } from 'lucide-react';

const fetchHealth = () => fetch('/health').then(res => res.json());
const fetchEvents = () => fetch('/api/v1/events').then(res => res.json().then(data => data.events));

export default function Settings() {
  const { data: health, isLoading: loadingHealth } = useQuery({ queryKey: ['health'], queryFn: fetchHealth });
  const { data: events = [], isLoading: loadingEvents } = useQuery({ queryKey: ['events'], queryFn: fetchEvents });

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '--';
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const getDatabaseStatus = () => {
    if (loadingEvents) return 'Checking...';
    return events ? 'Connected (SQLite via Drizzle ORM)' : 'Disconnected';
  };

  return (
    <div className="flex h-full flex-col relative animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">System configuration and operational status.</p>
        </div>
      </div>

      <div className="flex-1 p-8 pt-0 overflow-auto">
        <div className="max-w-4xl space-y-6">
          
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="p-6 border-b flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold leading-none tracking-tight">System Information</h3>
            </div>
            <div className="p-6">
              {loadingHealth ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex justify-between py-3 border-b last:border-0">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-0 divide-y divide-border">
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-md"><Server className="w-4 h-4 text-primary" /></div>
                      <div>
                        <p className="font-medium text-sm">Gateway Version</p>
                        <p className="text-xs text-muted-foreground">The current build version of the Kamna Event Gateway.</p>
                      </div>
                    </div>
                    <span className="font-mono text-sm bg-muted px-2 py-1 rounded-md">{health?.version}</span>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-md"><Database className="w-4 h-4 text-primary" /></div>
                      <div>
                        <p className="font-medium text-sm">Database Driver</p>
                        <p className="text-xs text-muted-foreground">Persistent storage engine configuration.</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      {getDatabaseStatus()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-md"><Terminal className="w-4 h-4 text-primary" /></div>
                      <div>
                        <p className="font-medium text-sm">Node.js Runtime</p>
                        <p className="text-xs text-muted-foreground">The underlying V8 engine version.</p>
                      </div>
                    </div>
                    <span className="font-mono text-sm">{health?.nodeVersion || 'N/A'}</span>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-md"><Code className="w-4 h-4 text-primary" /></div>
                      <div>
                        <p className="font-medium text-sm">Environment</p>
                        <p className="text-xs text-muted-foreground">Execution environment phase.</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-500 ring-1 ring-inset ring-blue-500/20 uppercase tracking-wider">
                      {health?.environment || 'PRODUCTION'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-md"><Activity className="w-4 h-4 text-primary" /></div>
                      <div>
                        <p className="font-medium text-sm">System Uptime</p>
                        <p className="text-xs text-muted-foreground">Time elapsed since the Node.js process started.</p>
                      </div>
                    </div>
                    <span className="font-mono text-sm">{formatUptime(health?.uptime)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

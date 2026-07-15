import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, Server, CheckCircle2, XCircle, Zap, MapPin, Send, HardDrive } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fetchers
import { apiFetch } from '../utils/api';

const fetchHealth = () => apiFetch('/health').then(res => res.json());
const fetchEvents = () => apiFetch('/api/v1/events').then(res => res.json().then(data => data.events));
const fetchDeliveries = () => apiFetch('/api/v1/deliveries').then(res => res.json().then(data => data.deliveries));
const fetchDestinations = () => apiFetch('/api/v1/destinations').then(res => res.json().then(data => data.destinations));

// UI Components
function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)}>
      {children}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export default function Dashboard() {
  const { data: health, isLoading: loadingHealth } = useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 5000 });
  const { data: events = [], isLoading: loadingEvents } = useQuery({ queryKey: ['events'], queryFn: fetchEvents, refetchInterval: 5000 });
  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({ queryKey: ['deliveries'], queryFn: fetchDeliveries, refetchInterval: 5000 });
  const { data: destinations = [], isLoading: loadingDestinations } = useQuery({ queryKey: ['destinations'], queryFn: fetchDestinations, refetchInterval: 5000 });

  const isLoading = loadingHealth || loadingEvents || loadingDeliveries || loadingDestinations;

  // Derived Metrics
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const eventsToday = events.filter((e: any) => new Date(e.receivedAt) >= todayStart).length;
  const deliveriesToday = deliveries.filter((d: any) => new Date(d.queuedAt) >= todayStart).length;
  
  const successfulDeliveries = deliveries.filter((d: any) => d.status === 'success').length;
  const successRate = deliveries.length > 0 ? Math.round((successfulDeliveries / deliveries.length) * 100) : 0;
  
  const completedDeliveries = deliveries.filter((d: any) => d.latencyMs != null);
  const avgLatency = completedDeliveries.length > 0 
    ? Math.round(completedDeliveries.reduce((acc: number, d: any) => acc + d.latencyMs, 0) / completedDeliveries.length)
    : 0;
    
  const activeDestinations = destinations.filter((d: any) => d.enabled).length;

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

  if (isLoading && !health) {
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-8 w-3/4" />
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6 h-64 flex flex-col justify-between">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <div className="space-y-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div>
          </Card>
          <Card className="p-6 h-64 flex flex-col justify-between">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <div className="space-y-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
      </div>

      {/* Primary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Events Today</p>
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">{eventsToday}</h2>
            <p className="text-xs text-muted-foreground mt-1">Processed securely</p>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Deliveries Today</p>
            <Send className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">{deliveriesToday}</h2>
            <p className="text-xs text-muted-foreground mt-1">Dispatched to endpoints</p>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Global Success Rate</p>
            <Activity className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">{successRate}%</h2>
            <p className="text-xs text-muted-foreground mt-1">All time average</p>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Average Latency</p>
            <Clock className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">{avgLatency} ms</h2>
            <p className="text-xs text-muted-foreground mt-1">Downstream response time</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* System Health */}
        <Card className="lg:col-span-3">
          <div className="p-6 border-b">
            <h3 className="font-semibold leading-none tracking-tight">System Health</h3>
            <p className="text-sm text-muted-foreground mt-2">Operational status of the Gateway infrastructure.</p>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full"><Server className="w-4 h-4 text-primary" /></div>
                <div>
                  <p className="font-medium text-sm">Gateway Version</p>
                  <p className="text-xs text-muted-foreground">Kamna Event Gateway v{health?.version}</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500 ring-1 ring-inset ring-green-500/20">Active</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full"><Clock className="w-4 h-4 text-primary" /></div>
                <div>
                  <p className="font-medium text-sm">Uptime</p>
                  <p className="text-xs text-muted-foreground">Continuous operation</p>
                </div>
              </div>
              <span className="text-sm font-medium">{formatUptime(health?.uptime)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full"><HardDrive className="w-4 h-4 text-primary" /></div>
                <div>
                  <p className="font-medium text-sm">Database</p>
                  <p className="text-xs text-muted-foreground">Persistent Storage</p>
                </div>
              </div>
              <span className="text-sm font-medium">{getDatabaseStatus()}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full"><MapPin className="w-4 h-4 text-primary" /></div>
                <div>
                  <p className="font-medium text-sm">Dispatcher & Registry</p>
                  <p className="text-xs text-muted-foreground">{activeDestinations} destinations active</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500 ring-1 ring-inset ring-green-500/20">Operational</span>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-4 flex flex-col">
          <div className="p-6 border-b">
            <h3 className="font-semibold leading-none tracking-tight">Recent Activity</h3>
            <p className="text-sm text-muted-foreground mt-2">Latest deliveries dispatched to destinations.</p>
          </div>
          <div className="flex-1 p-0">
            {deliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No activity yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  The Gateway hasn't processed any events or deliveries yet. Send a webhook to see activity here.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {deliveries.slice(0, 5).map((delivery: any) => (
                  <div key={delivery.id} className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {delivery.status === 'success' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : delivery.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Activity className="h-5 w-5 text-orange-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">Delivery #{delivery.id}</p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{delivery.eventId.substring(0, 18)}...</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
                        delivery.status === 'success' ? "bg-green-500/10 text-green-500 ring-green-500/20" :
                        delivery.status === 'failed' ? "bg-red-500/10 text-red-500 ring-red-500/20" :
                        "bg-orange-500/10 text-orange-500 ring-orange-500/20"
                      )}>
                        {delivery.status.toUpperCase()}
                      </span>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(delivery.queuedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}

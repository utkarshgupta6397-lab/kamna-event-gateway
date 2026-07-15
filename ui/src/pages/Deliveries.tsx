import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Search, ArrowUpDown, ChevronLeft, ChevronRight, X, 
  Activity, CheckCircle2, XCircle, Clock, RefreshCw, Network
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { apiFetch } from '../utils/api';

// --- API Fetchers ---
const fetchDeliveries = async () => {
  const res = await apiFetch('/api/v1/deliveries');
  if (!res.ok) throw new Error('Failed to fetch deliveries');
  const data = await res.json();
  return data.deliveries;
};

const fetchDestinations = async () => {
  const res = await apiFetch('/api/v1/destinations');
  if (!res.ok) throw new Error('Failed to fetch destinations');
  const data = await res.json();
  return data.destinations;
};

const fetchEvents = async () => {
  const res = await apiFetch('/api/v1/events');
  if (!res.ok) throw new Error('Failed to fetch events');
  const data = await res.json();
  return data.events;
};

export default function Deliveries() {
  const { data: deliveries = [], isLoading } = useQuery({ queryKey: ['deliveries'], queryFn: fetchDeliveries, refetchInterval: 5000 });
  const { data: destinations = [] } = useQuery({ queryKey: ['destinations'], queryFn: fetchDestinations });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: fetchEvents });

  // --- State ---
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'queuedAt' | 'latencyMs' | 'status'>('queuedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedDelivery, setSelectedDelivery] = useState<any | null>(null);
  
  // Drawer state
  const [activeTab, setActiveTab] = useState<'response' | 'request' | 'headers' | 'error'>('response');

  // --- Derived Data ---
  const getDestinationName = (id: number) => {
    const dest = destinations.find((d: any) => d.id === id);
    return dest ? dest.name : `Unknown (${id})`;
  };

  const getDestinationHeaders = (id: number) => {
    const dest = destinations.find((d: any) => d.id === id);
    return dest?.headers || {};
  };

  const getEventPayload = (eventId: string) => {
    const ev = events.find((e: any) => e.eventId === eventId);
    return ev?.payload || null;
  };

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d: any) => {
      const q = search.toLowerCase();
      const destName = getDestinationName(d.destinationId).toLowerCase();
      return (
        d.eventId.toLowerCase().includes(q) ||
        destName.includes(q) ||
        d.status.toLowerCase().includes(q)
      );
    });
  }, [deliveries, search, destinations]);

  const sortedDeliveries = useMemo(() => {
    return [...filteredDeliveries].sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'queuedAt') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }
      if (sortField === 'latencyMs') {
        aVal = aVal ?? -1;
        bVal = bVal ?? -1;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDeliveries, sortField, sortDirection]);

  const paginatedDeliveries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedDeliveries.slice(start, start + pageSize);
  }, [sortedDeliveries, page, pageSize]);

  const totalPages = Math.ceil(sortedDeliveries.length / pageSize) || 1;

  // --- Handlers ---
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const closeDrawer = () => {
    setSelectedDelivery(null);
  };

  const openDrawer = (delivery: any) => {
    setSelectedDelivery(delivery);
    setActiveTab(delivery.status === 'failed' ? 'error' : 'response');
  };

  return (
    <div className="flex h-full flex-col relative animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deliveries</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monitor outbound dispatch tasks and destination responses.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 pt-0 overflow-hidden flex flex-col">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col h-full overflow-hidden">
          
          {/* Toolbar */}
          <div className="p-4 border-b flex items-center justify-between gap-4 bg-muted/20">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by Event ID, Destination, or Status..."
                className="w-full bg-background border border-input rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="w-full">
                <div className="border-b px-6 py-4 flex gap-4">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </div>
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="border-b px-6 py-4 flex items-center gap-6">
                    <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                    <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
                    <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : filteredDeliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No deliveries found</h3>
                <p className="text-sm text-muted-foreground mt-1">There are no outbound dispatch tasks matching your criteria.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold border-b sticky top-0 z-10">
                  <tr>
                    <th 
                      className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('queuedAt')}
                    >
                      <div className="flex items-center gap-2">
                        Queued At
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-6 py-4">Destination</th>
                    <th className="px-6 py-4">Event ID</th>
                    <th 
                      className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('latencyMs')}
                    >
                      <div className="flex items-center gap-2">
                        Latency
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedDeliveries.map((delivery: any) => (
                    <tr 
                      key={delivery.id} 
                      onClick={() => openDrawer(delivery)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-foreground font-medium">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {new Date(delivery.queuedAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Network className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{getDestinationName(delivery.destinationId)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-muted-foreground truncate w-40" title={delivery.eventId}>
                          {delivery.eventId}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
                          delivery.status === 'success' ? "bg-green-500/10 text-green-500 ring-green-500/20" : 
                          delivery.status === 'failed' ? "bg-red-500/10 text-red-500 ring-red-500/20" :
                          "bg-amber-500/10 text-amber-500 ring-amber-500/20"
                        )}>
                          {delivery.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                          {delivery.status === 'failed' && <XCircle className="w-3 h-3" />}
                          {delivery.status === 'pending' && <Activity className="w-3 h-3" />}
                          {delivery.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {delivery.latencyMs != null ? (
                          <span className={cn(
                            "font-mono text-xs px-2 py-1 rounded-md",
                            delivery.latencyMs > 1000 ? "bg-orange-500/10 text-orange-500" : "bg-muted text-foreground"
                          )}>
                            {delivery.latencyMs} ms
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          {!isLoading && filteredDeliveries.length > 0 && (
            <div className="border-t bg-muted/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, sortedDeliveries.length)} of {sortedDeliveries.length}
                </span>
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select 
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 border rounded-md disabled:opacity-50 hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium px-2">Page {page} of {totalPages}</span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 border rounded-md disabled:opacity-50 hover:bg-muted transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Drawer Overlay */}
      {selectedDelivery && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity" 
          onClick={closeDrawer}
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div 
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full bg-card border-l shadow-2xl transition-transform duration-300 ease-in-out sm:w-[500px] xl:w-[700px] flex flex-col",
          selectedDelivery ? "translate-x-0" : "translate-x-full"
        )}
      >
        {selectedDelivery && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Delivery Details</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground font-mono">ID: {selectedDelivery.id}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{getDestinationName(selectedDelivery.destinationId)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  disabled
                  className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md opacity-50 cursor-not-allowed flex items-center gap-2"
                  title="Retries will be supported in a future update."
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
                <button 
                  onClick={closeDrawer}
                  className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-4 divide-x border-b bg-muted/30">
              <div className="p-4 flex flex-col justify-center items-center">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-1">Status</span>
                <span className={cn(
                  "font-medium text-sm",
                  selectedDelivery.status === 'success' ? "text-green-500" : 
                  selectedDelivery.status === 'failed' ? "text-red-500" : "text-amber-500"
                )}>{selectedDelivery.status.toUpperCase()}</span>
              </div>
              <div className="p-4 flex flex-col justify-center items-center">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-1">Status Code</span>
                <span className="font-mono text-sm">{selectedDelivery.responseCode || 'N/A'}</span>
              </div>
              <div className="p-4 flex flex-col justify-center items-center">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-1">Latency</span>
                <span className="font-mono text-sm">{selectedDelivery.latencyMs != null ? `${selectedDelivery.latencyMs}ms` : 'N/A'}</span>
              </div>
              <div className="p-4 flex flex-col justify-center items-center">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-1">Attempt</span>
                <span className="font-mono text-sm">{selectedDelivery.attempt}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b flex items-center gap-6 bg-card">
              <button 
                onClick={() => setActiveTab('response')}
                className={cn("py-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'response' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                Response Body
              </button>
              {selectedDelivery.error && (
                <button 
                  onClick={() => setActiveTab('error')}
                  className={cn("py-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'error' ? "border-destructive text-destructive" : "border-transparent text-muted-foreground hover:text-destructive")}
                >
                  Failure Reason
                </button>
              )}
              <button 
                onClick={() => setActiveTab('request')}
                className={cn("py-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'request' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                Request Payload
              </button>
              <button 
                onClick={() => setActiveTab('headers')}
                className={cn("py-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'headers' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                Headers
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-hidden flex flex-col p-6 bg-muted/10">
              <div className="flex-1 overflow-auto rounded-lg border bg-zinc-950 text-zinc-50 relative">
                
                {activeTab === 'response' && (
                  <SyntaxHighlighter 
                    language="json" 
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
                  >
                    {selectedDelivery.responseBody 
                      ? (() => {
                          try { return JSON.stringify(JSON.parse(selectedDelivery.responseBody), null, 2); } 
                          catch (e) { return selectedDelivery.responseBody; }
                        })()
                      : 'No response body captured.'}
                  </SyntaxHighlighter>
                )}

                {activeTab === 'error' && (
                  <div className="p-4 font-mono text-sm text-red-400 whitespace-pre-wrap">
                    {selectedDelivery.error || 'No error captured.'}
                  </div>
                )}

                {activeTab === 'request' && (
                  <SyntaxHighlighter 
                    language="json" 
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
                  >
                    {getEventPayload(selectedDelivery.eventId) 
                      ? JSON.stringify(getEventPayload(selectedDelivery.eventId), null, 2)
                      : '// Original event payload is not available in the recent cache cache or was empty.\n// Event ID: ' + selectedDelivery.eventId}
                  </SyntaxHighlighter>
                )}

                {activeTab === 'headers' && (
                  <SyntaxHighlighter 
                    language="json" 
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
                  >
                    {JSON.stringify(getDestinationHeaders(selectedDelivery.destinationId), null, 2)}
                  </SyntaxHighlighter>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

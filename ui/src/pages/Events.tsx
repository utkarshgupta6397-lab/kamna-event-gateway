import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Search, ArrowUpDown, ChevronLeft, ChevronRight, X, 
  Download, Copy, Check, Filter, Calendar
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- API Fetchers ---
const fetchEvents = async () => {
  const res = await fetch('/api/v1/events');
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json().then(data => data.events);
};

export default function Events() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    refetchInterval: 10000,
  });

  // --- State ---
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'receivedAt' | 'type' | 'source' | 'status'>('receivedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  
  // Drawer state
  const [activeTab, setActiveTab] = useState<'payload' | 'metadata' | 'headers'>('payload');
  const [copied, setCopied] = useState(false);

  // --- Derived Data ---
  const filteredEvents = useMemo(() => {
    return events.filter((e: any) => {
      const q = search.toLowerCase();
      return (
        e.eventId.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q)
      );
    });
  }, [events, search]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'receivedAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEvents, sortField, sortDirection]);

  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedEvents.slice(start, start + pageSize);
  }, [sortedEvents, page, pageSize]);

  const totalPages = Math.ceil(sortedEvents.length / pageSize);

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

  const copyJson = async (data: any) => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const closeDrawer = () => {
    setSelectedEvent(null);
  };

  return (
    <div className="flex h-full flex-col relative animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-1 text-sm">View and inspect incoming domain events.</p>
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
                placeholder="Search by ID, type, or source..."
                className="w-full bg-background border border-input rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Filter className="w-4 h-4" />
                {filteredEvents.length} events
              </span>
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
                    <div className="h-6 w-24 bg-muted animate-pulse rounded-full" />
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
                  </div>
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No events found</h3>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search criteria.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold border-b sticky top-0 z-10">
                  <tr>
                    <th 
                      className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('receivedAt')}
                    >
                      <div className="flex items-center gap-2">
                        Received At
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-6 py-4">Event ID</th>
                    <th 
                      className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center gap-2">
                        Type
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('source')}
                    >
                      <div className="flex items-center gap-2">
                        Source
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedEvents.map((event: any) => (
                    <tr 
                      key={event.id} 
                      onClick={() => { setSelectedEvent(event); setActiveTab('payload'); }}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-foreground font-medium">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {new Date(event.receivedAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-muted-foreground truncate w-48" title={event.eventId}>
                          {event.eventId}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500 ring-1 ring-inset ring-blue-500/20">
                          {event.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-foreground">{event.source}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
                          event.status === 'received' ? "bg-amber-500/10 text-amber-500 ring-amber-500/20" : "bg-green-500/10 text-green-500 ring-green-500/20"
                        )}>
                          {event.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          {!isLoading && filteredEvents.length > 0 && (
            <div className="border-t bg-muted/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, sortedEvents.length)} of {sortedEvents.length}
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
      {selectedEvent && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity" 
          onClick={closeDrawer}
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div 
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full bg-card border-l shadow-2xl transition-transform duration-300 ease-in-out sm:w-[600px] xl:w-[800px] flex flex-col",
          selectedEvent ? "translate-x-0" : "translate-x-full"
        )}
      >
        {selectedEvent && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Event Details</h2>
                <p className="text-xs text-muted-foreground font-mono mt-1">{selectedEvent.eventId}</p>
              </div>
              <button 
                onClick={closeDrawer}
                className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b flex items-center gap-6">
              <button 
                onClick={() => setActiveTab('payload')}
                className={cn("py-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'payload' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                Payload
              </button>
              <button 
                onClick={() => setActiveTab('metadata')}
                className={cn("py-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'metadata' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                Metadata
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
              <div className="flex items-center justify-end gap-2 mb-4">
                <button 
                  onClick={() => copyJson(
                    activeTab === 'payload' ? selectedEvent.payload : 
                    activeTab === 'metadata' ? selectedEvent.metadata : 
                    selectedEvent.metadata?.headers || {}
                  )}
                  className="px-3 py-1.5 text-xs font-medium bg-background border rounded-md hover:bg-muted transition-colors flex items-center gap-2 text-foreground"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
                <button 
                  onClick={() => downloadJson(
                    activeTab === 'payload' ? selectedEvent.payload : 
                    activeTab === 'metadata' ? selectedEvent.metadata : 
                    selectedEvent.metadata?.headers || {},
                    `event_${selectedEvent.eventId}_${activeTab}.json`
                  )}
                  className="px-3 py-1.5 text-xs font-medium bg-background border rounded-md hover:bg-muted transition-colors flex items-center gap-2 text-foreground"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>

              <div className="flex-1 overflow-auto rounded-lg border bg-zinc-950 text-zinc-50 relative">
                {activeTab === 'payload' && (
                  <SyntaxHighlighter 
                    language="json" 
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
                  >
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </SyntaxHighlighter>
                )}
                {activeTab === 'metadata' && (
                  <SyntaxHighlighter 
                    language="json" 
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
                  >
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </SyntaxHighlighter>
                )}
                {activeTab === 'headers' && (
                  <SyntaxHighlighter 
                    language="json" 
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
                  >
                    {JSON.stringify(selectedEvent.metadata?.headers || {}, null, 2)}
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

import { useState, useEffect } from 'react';
import { RefreshCw, Search, Filter, Webhook, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { WebhookDetailsDrawer } from '../components/WebhookDetailsDrawer';
import { apiFetch } from '../utils/api';

export default function WebhookInspector() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  
  const [selectedWebhook, setSelectedWebhook] = useState<any | null>(null);

  const fetchWebhooks = async (page = meta.page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: meta.limit.toString(),
        ...(search ? { search } : {}),
        ...(statusFilter !== 'All' ? { status: statusFilter } : {}),
        ...(typeFilter !== 'All' ? { eventType: typeFilter } : {}),
      });

      const res = await apiFetch(`/api/v1/webhook-inspector?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setWebhooks(json.data || []);
        setMeta(json.meta || meta);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWebhooks(1);
    const iv = setInterval(() => fetchWebhooks(), 10000); // auto-refresh
    return () => clearInterval(iv);
  }, [search, statusFilter, typeFilter]);

  const handleNext = () => {
    if (meta.page < meta.totalPages) fetchWebhooks(meta.page + 1);
  };

  const handlePrev = () => {
    if (meta.page > 1) fetchWebhooks(meta.page - 1);
  };

  const statusColors: Record<string, string> = {
    Received: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    'JSON Parsed': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6 pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Webhook className="text-indigo-500" /> Webhook Inspector
        </h1>
        <button 
          onClick={() => fetchWebhooks()} 
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 w-full md:w-96 focus-within:border-indigo-500 transition-colors">
          <Search size={16} className="text-slate-500" />
          <input 
            type="text" 
            placeholder="Search payload, message ID, or phone..." 
            className="bg-transparent text-sm text-slate-200 outline-none w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <select 
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Received">Received</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Webhook size={16} className="text-slate-500" />
            <select 
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="status">Status Update</option>
              <option value="message">Inbound Message</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/50 border-b border-slate-800">
              <tr className="text-slate-400 font-medium">
                <th className="py-4 px-6">ID</th>
                <th className="py-4 px-6">Timestamp</th>
                <th className="py-4 px-6">Type</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Latency</th>
                <th className="py-4 px-6">Matching</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading && webhooks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Loading webhooks...</td>
                </tr>
              ) : webhooks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">No webhooks found.</td>
                </tr>
              ) : webhooks.map((w) => (
                <tr 
                  key={w.id} 
                  onClick={() => setSelectedWebhook(w)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-6 font-mono text-slate-500 text-xs">#{w.id}</td>
                  <td className="py-3 px-6 text-slate-300">{new Date(w.receivedAt).toLocaleString()}</td>
                  <td className="py-3 px-6 capitalize text-slate-300">{w.eventType || '-'}</td>
                  <td className="py-3 px-6">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded border ${statusColors[w.processingStatus] || statusColors['Received']}`}>
                      {w.processingStatus}
                    </span>
                  </td>
                  <td className="py-3 px-6 font-mono text-slate-400">
                    {w.processingTimeMs !== null ? `${w.processingTimeMs}ms` : '-'}
                  </td>
                  <td className="py-3 px-6 font-mono text-xs text-indigo-400/80">
                    {w.matchedCommunicationId || w.matchedProviderMessageId || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/30">
          <span className="text-sm text-slate-400">
            Showing page {meta.page} of {meta.totalPages} ({meta.total} total)
          </span>
          <div className="flex gap-2">
            <button 
              onClick={handlePrev} 
              disabled={meta.page <= 1}
              className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={handleNext}
              disabled={meta.page >= meta.totalPages}
              className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <WebhookDetailsDrawer 
        webhook={selectedWebhook} 
        onClose={() => setSelectedWebhook(null)} 
      />

    </div>
  );
}

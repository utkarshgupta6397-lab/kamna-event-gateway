import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../utils/api';
import { Search, Filter, MessageSquare, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CommunicationRecord {
  id: number;
  messageId: string;
  eventId: string;
  channel: string;
  recipient: string;
  template: string;
  requestedBy: string;
  source: string;
  status: string;
  createdAt: string;
}

export default function Communications() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [successMediaId, setSuccessMediaId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['communications'],
    queryFn: async () => {
      const response = await apiFetch('/api/v1/messages');
      if (!response.ok) throw new Error('Failed to fetch communications');
      const json = await response.json();
      return (json.messages || []) as CommunicationRecord[];
    },
    refetchInterval: 5000,
  });

  const communications = data || [];

  const filteredComms = communications.filter(comm => {
    const matchesSearch = 
      comm.recipient.includes(searchQuery) || 
      comm.messageId.includes(searchQuery) ||
      comm.eventId.includes(searchQuery) ||
      comm.template.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'ALL' || comm.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'QUEUED': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'VALIDATED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'SENDING': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'SENT': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'DELIVERED': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'READ': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'FAILED': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200">
      <header className="flex-none p-6 pb-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <MessageSquare className="text-indigo-500" /> Communications
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Single source of truth for every outbound communication.
          </p>
        </div>
      </header>
      
      {successMediaId && (
        <div className="px-6 py-3 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400">✓</span>
            Test Media Template queued successfully (Communication ID: {successMediaId})
          </div>
          <button
            onClick={() => navigate(`/dashboard/communications/${successMediaId}`)}
            className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded text-xs font-medium transition-colors"
          >
            Open Communication
          </button>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Controls */}
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search recipient, ID, template..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="VALIDATED">Validated</option>
              <option value="SENDING">Sending</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="READ">Read</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900/50 relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-8 text-center text-red-400">
              Failed to load communications.
            </div>
          )}

          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900 sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Created Time</th>
                <th className="px-6 py-4 font-semibold">Recipient</th>
                <th className="px-6 py-4 font-semibold">Template</th>
                <th className="px-6 py-4 font-semibold">Channel</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Requested By</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredComms.map((comm) => (
                <tr 
                  key={comm.id} 
                  onClick={() => navigate(`/dashboard/communications/${comm.messageId}`)}
                  className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(comm.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-200">
                    {comm.recipient}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs">{comm.template}</span>
                  </td>
                  <td className="px-6 py-4 capitalize">
                    {comm.channel}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${getStatusColor(comm.status)}`}>
                      {comm.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {comm.requestedBy}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight size={16} className="inline-block text-slate-500 group-hover:text-white transition-colors" />
                  </td>
                </tr>
              ))}

              {!isLoading && filteredComms.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-500">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg">No communications found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

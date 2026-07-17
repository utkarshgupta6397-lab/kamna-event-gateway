import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../utils/api';
import { ArrowLeft, Clock, Copy, Check, MessageSquare, Terminal } from 'lucide-react';
import { useState } from 'react';

export default function CommunicationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: message, isLoading, error } = useQuery({
    queryKey: ['communication', id],
    queryFn: async () => {
      const response = await apiFetch(`/api/v1/messages/${id}`);
      if (!response.ok) throw new Error('Failed to fetch communication details');
      const json = await response.json();
      return json.message;
    },
    refetchInterval: 5000,
  });

  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'QUEUED': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'VALIDATED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'SENDING': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'META_ACCEPTED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'DELIVERED': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'READ': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'REPLIED': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'FAILED': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  // message.timeline comes from the API and contains { status, description, createdAt }
  const getTimelineSteps = () => {
    if (!message) return [];
    
    // Default structure based on API statuses
    const baseSteps = [
      { id: 'QUEUED', name: 'Communication Requested', status: 'pending' },
      { id: 'VALIDATED', name: 'Validated', status: 'pending' },
      { id: 'PROCESSING', name: 'Processing', status: 'pending' },
      { id: 'SENDING', name: 'Sending to Provider', status: 'pending' },
      { id: 'META_ACCEPTED', name: 'Accepted by Meta', status: 'pending' },
      { id: 'DELIVERED', name: 'Delivered', status: 'pending' },
      { id: 'READ', name: 'Read', status: 'pending' },
      { id: 'REPLIED', name: 'Customer Replied', status: 'pending' },
    ];

    // Add FAILED to the logical progression if it's the current status
    if (message.status === 'FAILED') {
      const lastCompletedIdx = baseSteps.reduce((acc, step, idx) => {
        return message.timeline?.find((t: any) => t.status === step.id) ? idx : acc;
      }, -1);
      
      return baseSteps.map((step, idx) => {
        const dbEntry = message.timeline?.find((t: any) => t.status === step.id);
        
        let status = 'pending';
        if (dbEntry || idx <= lastCompletedIdx) {
          status = 'completed';
        }
        
        return {
          name: dbEntry ? dbEntry.description : step.name,
          status,
          timestamp: dbEntry?.createdAt
        };
      }).concat({
        name: message.timeline?.find((t: any) => t.status === 'FAILED')?.description || 'Failed',
        status: 'failed',
        timestamp: message.timeline?.find((t: any) => t.status === 'FAILED')?.createdAt
      });
    }

    const currentIdx = baseSteps.findIndex(s => s.id === message.status);
    
    return baseSteps.map((step, idx) => {
      // If we have a matching DB timeline entry, use its description
      const dbEntry = message.timeline?.find((t: any) => t.status === step.id);
      
      let status = 'pending';
      if (idx < currentIdx) status = 'completed';
      if (idx === currentIdx) status = 'current';

      // Mark as completed if the message has passed this state but we don't have an exact match in the simple DB check
      if (status === 'pending' && currentIdx > idx) {
         status = 'completed';
      }
      
      // If it exists in DB, it is definitely completed (even if currentIdx doesn't match perfectly)
      if (dbEntry && status === 'pending') {
         status = 'completed';
      }

      return {
        name: dbEntry ? dbEntry.description : step.name,
        status,
        timestamp: dbEntry?.createdAt
      };
    });
  };

  const timelineSteps = getTimelineSteps();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !message) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-slate-200">
        <p className="text-xl font-bold mb-4">Communication Not Found</p>
        <button onClick={() => navigate('/dashboard/communications')} className="text-indigo-400 hover:underline">
          &larr; Back to Communications
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-200 p-6 overflow-y-auto">
      <button 
        onClick={() => navigate('/dashboard/communications')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Communications
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
            <MessageSquare className="text-indigo-500" />
            Message Inspector
          </h1>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            <span className="font-mono text-xs">{message.messageId}</span>
          </p>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold border uppercase tracking-wider ${getStatusColor(message.status)}`}>
          {message.status}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          
          {/* Overview Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-slate-500 mb-1">Recipient</p>
                <p className="font-medium text-slate-200">{message.recipient}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Channel</p>
                <p className="font-medium text-slate-200 capitalize">{message.channel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Template</p>
                <p className="font-mono text-sm text-slate-200">{message.template}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Source</p>
                <p className="font-medium text-slate-200">{message.source}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Requested By</p>
                <p className="font-medium text-slate-200">{message.requestedBy}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Created At</p>
                <p className="font-medium text-slate-200 flex items-center gap-2">
                  <Clock size={14} className="text-slate-500" />
                  {new Date(message.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="col-span-full">
                <p className="text-xs text-slate-500 mb-1">Event ID (Internal)</p>
                <p className="font-mono text-xs text-slate-400">{message.eventId}</p>
              </div>
            </div>
          </div>

          {/* Provider Information Panel */}
          {message.provider && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Provider Information</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Transport</p>
                  <p className="font-medium text-slate-200">{message.provider}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Provider Message ID</p>
                  <p className="font-mono text-sm text-slate-200">{message.providerMessageId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Provider Status</p>
                  <p className="font-medium text-slate-200 capitalize">{message.providerStatus || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">HTTP Status</p>
                  <p className="font-mono text-sm flex items-center gap-2">
                    {message.providerHttpStatus ? (
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        message.providerHttpStatus >= 200 && message.providerHttpStatus < 300
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {message.providerHttpStatus}
                      </span>
                    ) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Latency</p>
                  <p className="font-medium text-slate-200 flex items-center gap-2">
                    {message.providerLatency ? `${message.providerLatency}ms` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Accepted At</p>
                  <p className="font-medium text-slate-200 flex items-center gap-2">
                    <Clock size={14} className="text-slate-500" />
                    {message.acceptedAt ? new Date(message.acceptedAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              {message.providerResponse && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-500">Provider Response</p>
                    <button 
                      onClick={() => handleCopy(JSON.stringify(message.providerResponse, null, 2), 'provider')}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      {copiedSection === 'provider' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="bg-slate-950/50 p-4 rounded-lg overflow-auto max-h-64 border border-slate-800">
                    <pre className="text-xs font-mono text-blue-300">
                      {JSON.stringify(message.providerResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Variables JSON */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Terminal size={14} /> Variables
              </h3>
              <button 
                onClick={() => handleCopy(JSON.stringify(message.variables, null, 2), 'vars')}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {copiedSection === 'vars' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-64 bg-slate-950/50">
              <pre className="text-xs font-mono text-indigo-300">
                {JSON.stringify(message.variables, null, 2) || '{}'}
              </pre>
            </div>
          </div>

          {/* Metadata JSON */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Terminal size={14} /> Metadata
              </h3>
              <button 
                onClick={() => handleCopy(JSON.stringify(message.metadata, null, 2), 'meta')}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {copiedSection === 'meta' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-64 bg-slate-950/50">
              <pre className="text-xs font-mono text-emerald-300">
                {JSON.stringify(message.metadata, null, 2) || '{}'}
              </pre>
            </div>
          </div>
          
        </div>

        {/* Right Column: Timeline */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit">
          <h2 className="text-lg font-semibold text-white mb-6">Delivery Timeline</h2>
          <div className="relative pl-6 border-l-2 border-slate-800 space-y-8">
            {timelineSteps.map((step, idx) => (
              <div key={idx} className="relative">
                <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-4 border-slate-900 ${
                  step.status === 'completed' ? 'bg-indigo-500' :
                  step.status === 'current' ? 'bg-orange-500 animate-pulse' :
                  step.status === 'failed' ? 'bg-red-500' :
                  'bg-slate-700'
                }`} />
                <div className={`${
                  step.status === 'completed' ? 'text-slate-200' :
                  step.status === 'current' ? 'text-white font-semibold' :
                  step.status === 'failed' ? 'text-red-400 font-semibold' :
                  'text-slate-500'
                }`}>
                  <p className="text-sm">{step.name}</p>
                  {step.status === 'pending' && <p className="text-xs mt-1 italic">Awaiting response...</p>}
                  {step.timestamp && <p className="text-xs mt-1 opacity-60 flex items-center gap-1"><Clock size={12}/> {new Date(step.timestamp).toLocaleTimeString()}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

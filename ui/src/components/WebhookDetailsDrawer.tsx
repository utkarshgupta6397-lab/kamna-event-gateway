import { useState } from 'react';
import { X, Copy, Check, Clock, Globe, Shield, Terminal, ArrowRight, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface WebhookDetailsDrawerProps {
  webhook: any;
  onClose: () => void;
}

export const WebhookDetailsDrawer: React.FC<WebhookDetailsDrawerProps> = ({ webhook, onClose }) => {
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState(false);

  if (!webhook) return null;

  const handleCopy = (text: string, type: 'raw' | 'headers') => {
    navigator.clipboard.writeText(text);
    if (type === 'raw') {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } else {
      setCopiedHeaders(true);
      setTimeout(() => setCopiedHeaders(false), 2000);
    }
  };

  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(webhook.rawBody || JSON.stringify(webhook.bodyJson, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `webhook-${webhook.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const statusColor = 
    webhook.processingStatus === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
    webhook.processingStatus === 'Failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Drawer */}
      <div className="relative w-full max-w-3xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              Webhook #{webhook.id}
              <span className={`px-2.5 py-1 text-xs font-semibold rounded border ${statusColor}`}>
                {webhook.processingStatus}
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Received {new Date(webhook.receivedAt).toLocaleString()} via {webhook.provider}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Overview Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-slate-500 text-xs mb-1 flex items-center gap-1.5"><Globe size={14} /> Method & URL</div>
              <div className="font-mono text-sm text-slate-200 truncate" title={`${webhook.httpMethod} ${webhook.requestUrl}`}>
                <span className="text-indigo-400">{webhook.httpMethod}</span> {webhook.requestUrl}
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-slate-500 text-xs mb-1 flex items-center gap-1.5"><Clock size={14} /> Processing Time</div>
              <div className="font-mono text-sm text-slate-200">
                {webhook.processingTimeMs !== null ? `${webhook.processingTimeMs}ms` : 'Pending'}
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-slate-500 text-xs mb-1 flex items-center gap-1.5"><Shield size={14} /> IP Address</div>
              <div className="font-mono text-sm text-slate-200">{webhook.ipAddress || 'Unknown'}</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-slate-500 text-xs mb-1 flex items-center gap-1.5"><Terminal size={14} /> Event Type</div>
              <div className="font-mono text-sm text-slate-200 capitalize">{webhook.eventType || 'Unknown'}</div>
            </div>
          </div>

          {/* Errors */}
          {webhook.errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-2">
                <AlertTriangle size={16} /> Processing Error
              </h3>
              <p className="text-sm text-red-300 font-mono break-all">{webhook.errorMessage}</p>
            </div>
          )}

          {/* Communication Matching */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <ArrowRight size={16} className="text-indigo-500" /> Correlation & Matching
              </h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Provider Message ID</p>
                <p className="font-mono text-sm text-slate-300">{webhook.matchedProviderMessageId || 'None'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Internal Communication ID</p>
                {webhook.matchedCommunicationId ? (
                  <Link to={`/dashboard/communications/${webhook.matchedCommunicationId}`} className="font-mono text-sm text-indigo-400 hover:text-indigo-300 underline">
                    {webhook.matchedCommunicationId}
                  </Link>
                ) : (
                  <p className="font-mono text-sm text-slate-500">Not Matched</p>
                )}
              </div>
            </div>
          </div>

          {/* Raw JSON */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
              <h3 className="text-sm font-semibold text-slate-200">Raw Payload</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleCopy(webhook.rawBody || JSON.stringify(webhook.bodyJson, null, 2), 'raw')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition-colors"
                >
                  {copiedRaw ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  Copy JSON
                </button>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 rounded text-xs font-medium transition-colors"
                >
                  Download
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-96 bg-black/40">
              <pre className="text-xs font-mono text-emerald-400/90 whitespace-pre-wrap">
                {webhook.bodyJson ? JSON.stringify(webhook.bodyJson, null, 2) : webhook.rawBody}
              </pre>
            </div>
          </div>

          {/* Headers */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
              <h3 className="text-sm font-semibold text-slate-200">HTTP Headers</h3>
              <button 
                onClick={() => handleCopy(JSON.stringify(webhook.headersJson, null, 2), 'headers')}
                className="text-slate-400 hover:text-white transition-colors"
                title="Copy Headers"
              >
                {copiedHeaders ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-64 bg-black/40">
              <pre className="text-xs font-mono text-blue-300/90">
                {JSON.stringify(webhook.headersJson, null, 2)}
              </pre>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

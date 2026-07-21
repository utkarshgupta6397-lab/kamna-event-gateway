import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../utils/api';
import { ArrowLeft, Clock, Copy, Check, MessageSquare, Terminal, Zap, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const generateDebugReport = async () => {
    if (!message) return;
    setIsGeneratingReport(true);
    
    try {
      const response = await apiFetch(`/api/v1/webhook-inspector?search=${message.messageId}&limit=100`);
      let webhooksData = [];
      if (response.ok) {
        const json = await response.json();
        webhooksData = json.data || [];
      }

      let report = `===================================
KAMNA GATEWAY DEBUG REPORT
===================================

Communication ID: ${message.messageId}
Event ID: ${message.eventId}
Recipient: ${message.recipient}
Template: ${message.template}
Channel: ${message.channel}
Created At: ${new Date(message.createdAt).toLocaleString()}
Current Status: ${message.status}

--- Timeline ---
`;

      if (message.timeline && message.timeline.length > 0) {
        message.timeline.forEach((t: any) => {
          report += `${new Date(t.createdAt).toLocaleTimeString()} ${t.status} - ${t.description}\n`;
        });
      } else {
        report += `No timeline recorded.\n`;
      }

      const finalPayload = message.timeline?.find((t: any) => t.description === 'Template Sent')?.metadata?.payload || {};

      report += `
--- Provider Information ---
Provider Message ID: ${message.providerMessageId || 'N/A'}
HTTP Status: ${message.providerHttpStatus || 'N/A'}
Latency: ${message.providerLatency ? message.providerLatency + 'ms' : 'N/A'}
Accepted Timestamp: ${message.acceptedAt ? new Date(message.acceptedAt).toLocaleString() : 'N/A'}
Provider Status: ${message.providerStatus || 'N/A'}

--- Final Payload ---
${JSON.stringify(finalPayload, null, 2)}

--- Provider Response ---
${JSON.stringify(message.providerResponse || {}, null, 2)}
`;

      if (message.status === 'FAILED') {
        report += `
--- Failure Details ---
${JSON.stringify(message.providerResponse || {}, null, 2)}
`;
      }

      report += `
--- Latest Webhooks ---
`;
      if (webhooksData.length > 0) {
        webhooksData.forEach((w: any) => {
          report += `Timestamp: ${w.receivedAt ? new Date(w.receivedAt).toLocaleString() : 'N/A'}
Webhook Type: ${w.eventType || 'Unknown'}
Matched Provider Message ID: ${w.matchedProviderMessageId || 'N/A'}
Status Transition: ${w.processingStatus}
Processing Result: ${w.errorMessage || 'Success'}
Raw Payload: ${w.rawBody}
------------------------
`;
        });
      } else {
        report += `No webhooks found for this communication.\n`;
      }

      report += `
--- Communication Metadata ---
${JSON.stringify(message.metadata || {}, null, 2)}

--- Footer ---
Gateway Version: 0.0.1
Database: SQLite
Provider: ${message.provider || 'N/A'}
Generated Timestamp: ${new Date().toLocaleString()}
`;

      await navigator.clipboard.writeText(report);
      toast.success('Debug report copied to clipboard');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate debug report');
    } finally {
      setIsGeneratingReport(false);
    }
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

    const actualSteps: any[] = [];
    let currentIdx = -1;

    // 1. Add all steps that actually happened in order
    if (message.timeline && message.timeline.length > 0) {
      message.timeline.forEach((dbEntry: any, index: number) => {
        const isLast = index === message.timeline.length - 1;
        const isFailed = message.status === 'FAILED' && dbEntry.status === 'FAILED';
        
        actualSteps.push({
          id: dbEntry.status,
          name: dbEntry.description,
          status: isFailed ? 'failed' : (isLast && message.status !== 'META_ACCEPTED' && !['DELIVERED', 'READ', 'REPLIED'].includes(message.status) ? 'current' : 'completed'),
          timestamp: dbEntry.createdAt
        });

        // Track how far we've progressed in the baseSteps logical flow
        const baseIdx = baseSteps.findIndex(b => b.id === dbEntry.status);
        if (baseIdx > currentIdx) {
          currentIdx = baseIdx;
        }
      });
    }

    // 2. If it's failed, we don't show future pending steps
    if (message.status === 'FAILED') {
       return actualSteps;
    }

    // 3. Add future steps from baseSteps
    for (let i = currentIdx + 1; i < baseSteps.length; i++) {
      actualSteps.push({
        id: baseSteps[i].id,
        name: baseSteps[i].name,
        status: 'pending',
        timestamp: null
      });
    }

    return actualSteps;
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
        <div className="flex items-center gap-3">
          <button 
            onClick={generateDebugReport}
            disabled={isGeneratingReport}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border border-slate-700 disabled:opacity-50"
          >
            <FileText size={14} /> {isGeneratingReport ? 'Generating...' : 'Copy Debug Report'}
          </button>
          <button 
            onClick={() => navigate(`/dashboard/settings/diagnostics/webhooks?search=${message.messageId}`)}
            className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border border-indigo-500/30"
          >
            <Zap size={14} /> View Webhooks
          </button>
          <span className={`px-4 py-1.5 rounded-full text-sm font-bold border uppercase tracking-wider ${getStatusColor(message.status)}`}>
            {message.status}
          </span>
        </div>
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

          {/* Failure Details */}
          {message.status === 'FAILED' && message.providerResponse && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                Failure Details
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-slate-500 mb-1">HTTP Status</p>
                  <p className="font-mono text-sm text-red-300">{message.providerHttpStatus}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Error Code</p>
                  <p className="font-mono text-sm text-red-300">{message.providerResponse.error?.code || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Error Subcode</p>
                  <p className="font-mono text-sm text-red-300">{message.providerResponse.error?.error_subcode || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Error Type</p>
                  <p className="font-mono text-sm text-red-300">{message.providerResponse.error?.type || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-1">FB Trace ID</p>
                  <p className="font-mono text-sm text-slate-300">{message.providerResponse.error?.fbtrace_id || 'N/A'}</p>
                </div>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-lg overflow-auto max-h-64 border border-red-500/20">
                <pre className="text-xs font-mono text-red-300">
                  {JSON.stringify(message.providerResponse, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Timeline Metadata Extracted */}
          {(() => {
             const uploadReqEvent = message.timeline?.find((t: any) => t.description === 'Media Upload Request');
             const uploadResEvent = message.timeline?.find((t: any) => t.description === 'Media Uploaded');
             const sentEvent = message.timeline?.find((t: any) => t.description === 'Template Sent');

             return (
               <>
                 {uploadReqEvent && uploadReqEvent.metadata && uploadReqEvent.metadata.filename && (
                   <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                     <h2 className="text-lg font-semibold text-white mb-4">Meta Upload Request</h2>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <p className="text-xs text-slate-500 mb-1">Filename</p>
                         <p className="font-mono text-sm text-slate-200">{uploadReqEvent.metadata.filename}</p>
                       </div>
                       <div>
                         <p className="text-xs text-slate-500 mb-1">Mime Type</p>
                         <p className="font-mono text-sm text-slate-200">{uploadReqEvent.metadata.mimeType}</p>
                       </div>
                       <div>
                         <p className="text-xs text-slate-500 mb-1">File Size</p>
                         <p className="font-mono text-sm text-slate-200">{uploadReqEvent.metadata.fileSize} bytes</p>
                       </div>
                       <div>
                         <p className="text-xs text-slate-500 mb-1">Request Timestamp</p>
                         <p className="font-mono text-sm text-slate-200">{uploadReqEvent.metadata.requestTimestamp ? new Date(uploadReqEvent.metadata.requestTimestamp).toLocaleString() : 'N/A'}</p>
                       </div>
                     </div>
                   </div>
                 )}

                 {uploadResEvent && uploadResEvent.metadata && uploadResEvent.metadata.mediaId && (
                   <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                     <h2 className="text-lg font-semibold text-white mb-4">Meta Upload Response</h2>
                     <div className="grid grid-cols-2 gap-4 mb-4">
                       <div>
                         <p className="text-xs text-slate-500 mb-1">HTTP Status</p>
                         <p className="font-mono text-sm text-emerald-400">{uploadResEvent.metadata.httpStatus}</p>
                       </div>
                       <div>
                         <p className="text-xs text-slate-500 mb-1">Media ID</p>
                         <p className="font-mono text-sm text-slate-200">{uploadResEvent.metadata.mediaId}</p>
                       </div>
                     </div>
                     {uploadResEvent.metadata.response && (
                       <div className="bg-slate-950/50 p-4 rounded-lg overflow-auto max-h-64 border border-slate-800">
                         <pre className="text-xs font-mono text-blue-300">
                           {JSON.stringify(uploadResEvent.metadata.response, null, 2)}
                         </pre>
                       </div>
                     )}
                   </div>
                 )}

                 {sentEvent && sentEvent.metadata && sentEvent.metadata.payload && (
                   <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                     <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50">
                       <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                         <Terminal size={14} /> Final Payload
                       </h3>
                       <button 
                         onClick={() => handleCopy(JSON.stringify(sentEvent.metadata.payload, null, 2), 'payload')}
                         className="text-slate-400 hover:text-white transition-colors"
                       >
                         {copiedSection === 'payload' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                       </button>
                     </div>
                     <div className="p-4 overflow-auto max-h-64 bg-slate-950/50">
                       <pre className="text-xs font-mono text-emerald-300">
                         {JSON.stringify(sentEvent.metadata.payload, null, 2)}
                       </pre>
                     </div>
                   </div>
                 )}
               </>
             );
          })()}

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

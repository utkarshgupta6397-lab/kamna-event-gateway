import React from 'react';
import { X, Copy, CheckCircle2 } from 'lucide-react';
import type { LiveEvent } from '../../hooks/useEventStream';

interface EventDrawerProps {
  event: LiveEvent | null;
  onClose: () => void;
}

export const EventDrawer: React.FC<EventDrawerProps> = ({ event, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  // Close on ESC
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!event) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-[600px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 overflow-y-auto transform transition-transform duration-300 translate-x-0 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 sticky top-0 bg-slate-900/90 backdrop-blur-md">
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-3">
              Event Details
              <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded-md text-slate-400">
                {event.eventId || event.event?.eventId || 'unknown'}
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Type: {event.type}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleCopy}
              className="p-2 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
              title="Copy JSON"
            >
              {copied ? <CheckCircle2 size={20} className="text-green-500" /> : <Copy size={20} />}
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col gap-6">
          
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <p className="text-sm text-slate-200 capitalize">{event.event?.status || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Source</p>
                <p className="text-sm text-slate-200">{event.event?.source || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Received At</p>
                <p className="text-sm text-slate-200">
                  {event.event?.receivedAt ? new Date(event.event.receivedAt).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Processing Time</p>
                <p className="text-sm text-slate-200">{event.event?.processingTimeMs ? `${event.event.processingTimeMs}ms` : 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Raw Payload</h3>
            <div className="bg-[#0d1117] rounded-xl border border-slate-800 overflow-hidden h-full">
              <pre className="p-4 text-xs font-mono text-slate-300 overflow-auto max-h-[500px]">
                {JSON.stringify(event, null, 2)}
              </pre>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

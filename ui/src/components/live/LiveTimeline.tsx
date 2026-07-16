import React, { useMemo } from 'react';
import type { LiveEvent } from '../../hooks/useEventStream';
import { Zap, ArrowRight, CheckCircle2, XCircle, Clock, MessageCircle } from 'lucide-react';

interface LiveTimelineProps {
  events: LiveEvent[];
  searchQuery: string;
  onEventClick: (event: LiveEvent) => void;
}

export const LiveTimeline: React.FC<LiveTimelineProps> = ({ events, searchQuery, onEventClick }) => {
  
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const lowerQuery = searchQuery.toLowerCase();
    return events.filter(evt => {
      const type = evt.type?.toLowerCase() || '';
      const id = evt.event?.eventId?.toLowerCase() || '';
      const source = evt.event?.source?.toLowerCase() || '';
      return type.includes(lowerQuery) || id.includes(lowerQuery) || source.includes(lowerQuery);
    });
  }, [events, searchQuery]);



  const getIcon = (type: string) => {
    switch (type) {
      case 'EVENT_RECEIVED': return <Zap size={16} />;
      case 'DELIVERY_STARTED': return <ArrowRight size={16} />;
      case 'DELIVERY_SUCCESS': return <CheckCircle2 size={16} />;
      case 'DELIVERY_FAILED': return <XCircle size={16} />;
      case 'communication.outbound.requested': return <MessageCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
      <div className="max-w-5xl mx-auto flex flex-col gap-3">
        {filteredEvents.map((evt, idx) => {
          const isCommunicationEvent = evt.type.startsWith('communication.');
          const messageId = evt.event?.payload?.messageId;

          return (
          <div 
            key={`${evt.event?.eventId || 'unknown'}-${idx}`}
            onClick={() => {
              if (isCommunicationEvent && messageId) {
                window.location.href = `/dashboard/communications/${messageId}`;
              } else {
                onEventClick(evt);
              }
            }}
            className={`
              flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50 
              hover:bg-slate-800 transition-all cursor-pointer shadow-sm
              ${isCommunicationEvent ? 'border-l-4 border-l-emerald-500' : ''}
            `}
          >
            <div className="flex-none p-3 rounded-xl bg-slate-950/50 border border-slate-800/50 shadow-inner">
              {getIcon(evt.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 mb-1.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-semibold text-slate-200 truncate">{evt.type}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                    {evt.event?.source || 'system'}
                  </span>
                  {evt.status === 'QUEUED' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">Queued</span>}
                  {evt.type === 'communication.validated' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">Validated</span>}
                  {evt.type === 'communication.processing' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-wider">Processing</span>}
                  {evt.type === 'communication.sending' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 uppercase tracking-wider">Sending</span>}
                  {evt.type === 'communication.provider.accepted' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">Meta Accepted</span>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                {evt.type === 'communication.outbound.requested' ? (
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wide">
                      QUEUED
                    </span>
                    <span className="flex items-center gap-1">
                      Recipient: <span className="text-slate-300">{evt.event?.payload?.recipient || 'N/A'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      Template: <span className="text-slate-300">{evt.event?.payload?.template || 'N/A'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      Requested By: <span className="text-slate-300">{evt.event?.payload?.requestedBy || 'N/A'}</span>
                    </span>
                  </div>
                ) : (
                  <>
                    <span className="truncate font-mono">
                      {evt.event?.eventId || evt.delivery?.eventId || evt.deliveryId || 'Unknown ID'}
                    </span>
                    {evt.event?.processingTimeMs && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {evt.event.processingTimeMs}ms
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          );
        })}

        {filteredEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Zap size={48} className="mb-4 opacity-20" />
            <p className="text-lg">Waiting for live events...</p>
            <p className="text-sm opacity-60">Generate a test event to see the timeline in action.</p>
          </div>
        )}
      </div>
    </div>
  );
};

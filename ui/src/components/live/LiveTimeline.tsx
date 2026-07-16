import React, { useMemo } from 'react';
import type { LiveEvent } from '../../hooks/useEventStream';
import { Zap, ArrowRight, CheckCircle2, XCircle, Clock } from 'lucide-react';

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

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'EVENT_RECEIVED': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'DELIVERY_STARTED': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'DELIVERY_SUCCESS': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'DELIVERY_FAILED': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'EVENT_RECEIVED': return <Zap size={16} />;
      case 'DELIVERY_STARTED': return <ArrowRight size={16} />;
      case 'DELIVERY_SUCCESS': return <CheckCircle2 size={16} />;
      case 'DELIVERY_FAILED': return <XCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
      <div className="max-w-5xl mx-auto flex flex-col gap-3">
        {filteredEvents.map((evt, idx) => (
          <div 
            key={`${evt.event?.eventId || 'unknown'}-${idx}`}
            onClick={() => onEventClick(evt)}
            className={`
              flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50 
              hover:bg-slate-800 transition-all cursor-pointer shadow-sm
              animate-in slide-in-from-top-4 fade-in duration-300
            `}
          >
            <div className={`p-3 rounded-xl border ${getStatusColor(evt.type)}`}>
              {getIcon(evt.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold text-slate-200 truncate flex items-center gap-2">
                  {evt.type}
                  {evt.event?.source && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-medium text-slate-400">
                      {evt.event.source}
                    </span>
                  )}
                </h4>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="truncate font-mono">
                  {evt.event?.eventId || evt.delivery?.eventId || evt.deliveryId || 'Unknown ID'}
                </span>
                {evt.event?.processingTimeMs && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {evt.event.processingTimeMs}ms
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

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

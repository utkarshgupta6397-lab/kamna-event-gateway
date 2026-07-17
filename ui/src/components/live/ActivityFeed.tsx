import React, { useRef, useEffect } from 'react';
import type { LiveEvent } from '../../hooks/useEventStream';
import { CheckCircle2, XCircle, Clock, Zap, ArrowRight, ServerCrash, MessageSquare } from 'lucide-react';

interface ActivityFeedProps {
  events: LiveEvent[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'EVENT_RECEIVED': return <Zap size={14} className="text-blue-500" />;
      case 'DELIVERY_STARTED': return <ArrowRight size={14} className="text-yellow-500" />;
      case 'DELIVERY_SUCCESS': return <CheckCircle2 size={14} className="text-green-500" />;
      case 'DELIVERY_FAILED': return <XCircle size={14} className="text-red-500" />;
      case 'SYSTEM_ERROR': return <ServerCrash size={14} className="text-red-600" />;
      case 'communication.status.changed': return <CheckCircle2 size={14} className="text-purple-500" />;
      case 'communication.inbound.received': return <MessageSquare size={14} className="text-pink-500" />;
      default: return <Clock size={14} className="text-slate-500" />;
    }
  };

  const getActivityText = (event: LiveEvent) => {
    switch (event.type) {
      case 'EVENT_RECEIVED': return `Received ${event.event?.type || 'webhook'}`;
      case 'DELIVERY_STARTED': return `Dispatching delivery ${event.deliveryId}`;
      case 'DELIVERY_SUCCESS': return `Delivery ${event.delivery?.id} succeeded`;
      case 'DELIVERY_FAILED': return `Delivery ${event.delivery?.id} failed`;
      case 'SYSTEM_ERROR': return 'System error occurred';
      case 'communication.status.changed': return `Status changed to ${event.event?.payload?.newStatus}`;
      case 'communication.inbound.received': return `Reply from ${event.event?.payload?.senderName}`;
      default: return `Unknown action: ${event.type}`;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-200">Activity Feed</h3>
      </div>
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scroll-smooth"
      >
        {/* We reverse because we append to top of list, but want chronological order in feed */}
        {[...events].reverse().map((evt, idx) => (
          <div key={idx} className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="mt-0.5">
              {getActivityIcon(evt.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 truncate">
                {getActivityText(evt)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-slate-500">Waiting for activity...</p>
          </div>
        )}
      </div>
    </div>
  );
};

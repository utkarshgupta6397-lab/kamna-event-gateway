import { useState, useEffect, useRef, useCallback } from 'react';

export interface LiveEvent {
  type: string;
  [key: string]: any;
}

interface EventStreamState {
  connected: boolean;
  reconnecting: boolean;
  disconnected: boolean;
  events: LiveEvent[];
  stats: {
    eventsPerSec: number;
    queueSize: number;
    avgProcessingTime: number;
  };
}

export const useEventStream = (maxEvents = 1000) => {
  const [state, setState] = useState<EventStreamState>({
    connected: false,
    reconnecting: false,
    disconnected: true,
    events: [],
    stats: {
      eventsPerSec: 0,
      queueSize: 0,
      avgProcessingTime: 0,
    },
  });

  const [isPaused, setIsPaused] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bufferedEventsRef = useRef<LiveEvent[]>([]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = localStorage.getItem('gateway_token');
    // EventSource does not support custom headers natively; pass token as query param
    const url = `/api/v1/events/live?token=${token}`;
    
    const es = new EventSource(url);
    eventSourceRef.current = es;

    setState((prev) => ({ ...prev, reconnecting: prev.disconnected ? false : true, disconnected: false }));

    es.onopen = () => {
      setState((prev) => ({ ...prev, connected: true, reconnecting: false, disconnected: false }));
      resetHeartbeat();
    };

    es.onmessage = (event) => {
      resetHeartbeat();
      const data = JSON.parse(event.data);

      if (data.type === 'HEARTBEAT' || data.type === 'CONNECTED') {
        return;
      }

      if (isPaused) {
        bufferedEventsRef.current.unshift(data);
        if (bufferedEventsRef.current.length > maxEvents) {
          bufferedEventsRef.current.pop();
        }
      } else {
        setState((prev) => {
          const newEvents = [data, ...prev.events].slice(0, maxEvents);
          return {
            ...prev,
            events: newEvents,
            stats: updateStats(data, prev.stats),
          };
        });
      }
    };

    es.onerror = () => {
      handleDisconnect();
    };
  }, [isPaused, maxEvents]);

  const handleDisconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setState((prev) => ({ ...prev, connected: false, reconnecting: true, disconnected: false }));
    
    // Exponential backoff or simple retry
    if (!reconnectTimeoutRef.current) {
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = undefined;
        connect();
      }, 3000);
    }
  }, [connect]);

  const resetHeartbeat = () => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    // If no heartbeat in 25 seconds (server sends every 20s), assume disconnected
    heartbeatTimeoutRef.current = setTimeout(() => {
      handleDisconnect();
    }, 25000);
  };

  useEffect(() => {
    connect();

    // Disconnect SSE when the user logs out
    const handleLogout = () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setState((prev) => ({ ...prev, connected: false, reconnecting: false, disconnected: true }));
    };

    window.addEventListener('auth-logout', handleLogout);

    return () => {
      window.removeEventListener('auth-logout', handleLogout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
    };
  }, [connect]);

  // Flush buffer when unpaused
  useEffect(() => {
    if (!isPaused && bufferedEventsRef.current.length > 0) {
      setState((prev) => {
        const newEvents = [...bufferedEventsRef.current, ...prev.events].slice(0, maxEvents);
        bufferedEventsRef.current = [];
        return {
          ...prev,
          events: newEvents,
        };
      });
    }
  }, [isPaused, maxEvents]);

  const pause = () => setIsPaused(true);
  const resume = () => setIsPaused(false);

  return { ...state, isPaused, pause, resume };
};

// Simple stat aggregator
function updateStats(event: LiveEvent, currentStats: EventStreamState['stats']) {
  // In a real app, you'd calculate true rates. Here we simulate updates based on events.
  return {
    ...currentStats,
    eventsPerSec: currentStats.eventsPerSec + 0.1, // Mock metric
    queueSize: event.type === 'EVENT_RECEIVED' ? currentStats.queueSize + 1 : (event.type === 'DELIVERY_SUCCESS' || event.type === 'DELIVERY_FAILED') ? Math.max(0, currentStats.queueSize - 1) : currentStats.queueSize,
  };
}

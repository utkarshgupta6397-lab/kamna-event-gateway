import { useState, useEffect, useRef } from 'react';
import { Search, Pause, Play, Activity, AlertCircle } from 'lucide-react';
import { useEventStream } from '../hooks/useEventStream';
import type { LiveEvent } from '../hooks/useEventStream';
import { LiveTimeline } from '../components/live/LiveTimeline';
import { ActivityFeed } from '../components/live/ActivityFeed';
import { EventDrawer } from '../components/live/EventDrawer';
import { DevGenerator } from '../components/live/DevGenerator';

export default function Events() {
  const { 
    connected, 
    reconnecting, 
    disconnected, 
    events, 
    stats,
    isPaused, 
    pause, 
    resume 
  } = useEventStream(1000); // Buffer up to 1000 events

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input (except for shortcuts that shouldn't conflict)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      switch (e.key) {
        case '/': 
          e.preventDefault(); 
          searchInputRef.current?.focus(); 
          break;
        case ' ': 
          e.preventDefault();
          isPaused ? resume() : pause(); 
          break;
        case 'Escape':
          setSelectedEvent(null);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, pause, resume]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200 overflow-hidden relative">
      
      {/* HEADER */}
      <header className="flex-none h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold flex items-center gap-2 text-white">
            <Activity className="text-indigo-500" /> Observatory
          </h1>
          
          <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800/50">
            {connected ? (
              <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-xs font-medium text-green-500">Live</span></>
            ) : reconnecting ? (
              <><span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /><span className="text-xs font-medium text-orange-500">Reconnecting...</span></>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-xs font-medium text-red-500">Offline</span></>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400 mr-4">
            <div className="flex flex-col items-end">
              <span>{stats.eventsPerSec.toFixed(1)} /s</span>
              <span className="text-[10px] text-slate-500">Events Rate</span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div className="flex flex-col items-end">
              <span>{stats.queueSize}</span>
              <span className="text-[10px] text-slate-500">Queue</span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div className="flex flex-col items-end">
              <span>{events.length}</span>
              <span className="text-[10px] text-slate-500">Buffered</span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search (Press '/')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors w-64"
            />
          </div>

          <button
            onClick={isPaused ? resume : pause}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isPaused 
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Disconnected Overlay */}
        {disconnected && !reconnecting && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center gap-4 text-center max-w-sm">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                <AlertCircle size={32} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Connection Lost</h3>
                <p className="text-sm text-slate-400 mt-2">The real-time event stream has been disconnected. Attempting to reconnect automatically...</p>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <LiveTimeline 
          events={events} 
          searchQuery={searchQuery} 
          onEventClick={setSelectedEvent} 
        />

        {/* Right Sidebar Activity Feed */}
        <aside className="w-80 flex-none hidden lg:block">
          <ActivityFeed events={events} />
        </aside>

      </div>

      {/* Event Details Drawer */}
      <EventDrawer 
        event={selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
      />

      {/* Development Tool */}
      <DevGenerator />
    </div>
  );
}

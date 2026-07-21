import { useEffect, useState } from 'react';
import { Activity, Server, Zap, Globe, MessageSquare, Cpu, Terminal, Copy } from 'lucide-react';
import { useEventStream } from '../hooks/useEventStream';
import { apiFetch } from '../utils/api';

export default function Diagnostics() {
  const safeArray = (value: any) => Array.isArray(value) ? value : [];

  const [state, setState] = useState<any>(null);
  const [dbIntegrity, setDbIntegrity] = useState<any>(null);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const [logSearch, setLogSearch] = useState('');

  const { events } = useEventStream(); // To visually force re-renders if SSE triggers

  const fetchData = async () => {
    try {
      const [resState, resHooks, resLogs, resDb] = await Promise.all([
        apiFetch('/api/v1/diagnostics/state').then(r => r.json()),
        apiFetch('/api/v1/diagnostics/webhooks').then(r => r.json()),
        apiFetch('/api/v1/diagnostics/logs').then(r => r.json()),
        apiFetch('/api/v1/diagnostics/database').then(r => r.json()).catch(() => null)
      ]);
      setState(resState);
      setWebhooks(resHooks);
      setLogs(resLogs);
      if (resDb) setDbIntegrity(resDb);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [events]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, []);

  const filteredLogs = safeArray(logs).filter((l: any) => {
    if (logFilter && l.level !== logFilter) return false;
    if (logSearch && l.message && typeof l.message === 'string' && !l.message.toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  });

  const runTest = async (action: string, payload?: any) => {
    try {
      await apiFetch(`/api/v1/debug/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const copyReport = () => {
    const report = JSON.stringify({ state, recentWebhooks: safeArray(webhooks).slice(0,10), recentLogs: safeArray(logs).slice(0,50) }, null, 2);
    navigator.clipboard.writeText(report);
    alert('Diagnostics Report Copied!');
  };

  if (!state || !state.health || !state.meta || !state.system || !state.observatory) return <div className="p-8 text-slate-400">Loading diagnostics...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-8 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Activity className="text-indigo-500" /> Diagnostics
        </h1>
        <button onClick={copyReport} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <Copy size={16} /> Copy Debug Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* SECTION 1: Gateway Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Server className="text-emerald-500" /> Gateway Health</h2>
          <div className="flex flex-col gap-3">
            {Object.entries(state.health || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                {v ? <span className="text-emerald-500 font-bold">✓ Running</span> : <span className="text-red-500 font-bold">✗ Offline</span>}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: Meta Webhook */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Globe className="text-blue-500" /> Meta Webhook</h2>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between"><span>Verified</span> <span className={state.meta.webhookVerified ? "text-emerald-500" : "text-yellow-500"}>{state.meta.webhookVerified ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span>Last Incoming</span> <span className="font-mono text-xs text-slate-400">{state.meta.lastIncomingWebhook ? new Date(state.meta.lastIncomingWebhook).toLocaleString() : 'Never'}</span></div>
            <div className="flex justify-between"><span>Today's Count</span> <span className="font-bold text-indigo-400">{state.meta.incomingWebhookCountToday}</span></div>
          </div>
        </div>

        {/* SECTION 4: Observatory Diagnostics */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Zap className="text-yellow-500" /> Observatory (SSE)</h2>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between"><span>SSE Connected</span> <span className={state.observatory.connected ? "text-emerald-500" : "text-red-500"}>{state.observatory.connected ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span>Clients</span> <span className="font-bold">{state.observatory.connectedClients}</span></div>
            <div className="flex justify-between"><span>Total Events Sent</span> <span className="font-mono">{state.observatory.totalEventsSent}</span></div>
          </div>
        </div>

        {/* SECTION 4B: Database Integrity */}
        {dbIntegrity && (
          <div className={`bg-slate-900 border rounded-xl p-6 ${dbIntegrity.healthy ? 'border-slate-800' : 'border-red-500/50'}`}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Activity className={dbIntegrity.healthy ? "text-emerald-500" : "text-red-500"} /> Database Integrity
            </h2>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span>Status</span> 
                <span className={dbIntegrity.healthy ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>{dbIntegrity.healthy ? 'Healthy' : 'Compromised'}</span>
              </div>
              <div className="flex justify-between"><span>Schema Version</span> <span className="font-mono">{dbIntegrity.schemaVersion}</span></div>
              <div className="flex justify-between"><span>Pending Migrations</span> <span className={dbIntegrity.pendingMigrations === 0 ? "text-slate-400" : "text-yellow-500 font-bold"}>{dbIntegrity.pendingMigrations}</span></div>
              
              {!dbIntegrity.healthy && dbIntegrity.missingTables?.length > 0 && (
                <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded">
                  <div className="text-red-400 font-bold mb-1">Missing Tables:</div>
                  <ul className="list-disc pl-4 text-red-300 text-xs">
                    {dbIntegrity.missingTables.map((t: string) => <li key={t}>{t}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 5: Test Buttons */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Test Actions</h2>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => runTest('sse/ping')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors">Ping SSE</button>
          <button onClick={() => runTest('sse/broadcast', { count: 1 })} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors">Broadcast 1 Event</button>
          <button onClick={() => runTest('sse/broadcast', { count: 100 })} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors">Broadcast 100 Events</button>
          <button onClick={() => runTest('simulate/meta', { type: 'DELIVERED' })} className="px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 rounded text-sm transition-colors">Fake Delivered</button>
          <button onClick={() => runTest('simulate/meta', { type: 'READ' })} className="px-4 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 rounded text-sm transition-colors">Fake Read</button>
          <button onClick={() => runTest('simulate/meta', { type: 'FAILED' })} className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 rounded text-sm transition-colors">Fake Failed</button>
          <button onClick={() => runTest('simulate/meta', { type: 'REPLY' })} className="px-4 py-2 bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 border border-pink-500/30 rounded text-sm transition-colors">Fake Customer Reply</button>
        </div>
      </div>

      {/* SECTION 7: Current State */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Cpu className="text-orange-500" /> Current State</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-4 bg-slate-950 rounded border border-slate-800 shadow-inner">
            <div className="text-slate-500 mb-1">Memory Usage</div>
            <div className="text-lg font-mono text-slate-200">{(state.system.memoryUsage / 1024 / 1024).toFixed(2)} MB</div>
          </div>
          <div className="p-4 bg-slate-950 rounded border border-slate-800 shadow-inner">
            <div className="text-slate-500 mb-1">Uptime</div>
            <div className="text-lg font-mono text-slate-200">{Math.floor(state.system.uptime)}s</div>
          </div>
          <div className="p-4 bg-slate-950 rounded border border-slate-800 shadow-inner">
            <div className="text-slate-500 mb-1">Active Conns</div>
            <div className="text-lg font-mono text-slate-200">{state.system.activeConnections}</div>
          </div>
          <div className="p-4 bg-slate-950 rounded border border-slate-800 shadow-inner">
            <div className="text-slate-500 mb-1">CPU Load</div>
            <div className="text-lg font-mono text-slate-200">{safeArray(state.system.cpu)[0]?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Live Webhook Monitor */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MessageSquare className="text-green-500" /> Live Webhook Monitor (Top 500)</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-[500px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950 sticky top-0 z-10 shadow">
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-4 font-medium">Timestamp</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Error</th>
                <th className="py-3 px-4 font-medium">Payload (Snippet)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {safeArray(webhooks).map((w: any) => (
                <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-xs font-mono text-slate-400">{w.receivedAt ? new Date(w.receivedAt).toLocaleString() : 'N/A'}</td>
                  <td className="py-3 px-4">
                    {w.processed ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400">Processed</span> : 
                     w.processingError ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400">Rejected</span> : 
                     <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-400">Ignored</span>}
                  </td>
                  <td className="py-3 px-4 text-xs text-red-300 max-w-[150px] truncate">{w.processingError || '-'}</td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-500 truncate max-w-xl">{JSON.stringify(w.rawPayload || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 6: Raw Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Terminal className="text-slate-400" /> Raw Logs (Latest 100)</h2>
        <div className="flex gap-4 mb-4">
          <input type="text" placeholder="Search logs..." value={logSearch} onChange={e => setLogSearch(e.target.value)} className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200 outline-none w-64 focus:border-indigo-500" />
          <div className="flex gap-2">
            {['', 'INFO', 'WARN', 'ERROR', 'SSE', 'META', 'AUTH'].map(lvl => (
              <button key={lvl || 'ALL'} onClick={() => setLogFilter(lvl)} className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${logFilter === lvl ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                {lvl || 'ALL'}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-black/50 p-4 rounded-lg overflow-y-auto max-h-96 font-mono text-xs flex flex-col gap-1.5 border border-slate-800/50 shadow-inner">
          {filteredLogs.map((log, i) => (
            <div key={i} className="flex gap-3 hover:bg-white/5 p-1 rounded">
              <span className="text-slate-600 min-w-max">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className={`min-w-[50px] font-bold ${
                log.level === 'ERROR' ? 'text-red-500' :
                log.level === 'WARN' ? 'text-yellow-500' :
                log.level === 'INFO' ? 'text-blue-500' :
                log.level === 'SSE' ? 'text-purple-500' :
                log.level === 'META' ? 'text-emerald-500' :
                'text-slate-400'
              }`}>{log.level.padEnd(5)}</span>
              <span className="text-slate-300 break-all">{log.message}</span>
            </div>
          ))}
          {filteredLogs.length === 0 && <span className="text-slate-600 italic">No logs found matching criteria.</span>}
        </div>
      </div>

    </div>
  );
}

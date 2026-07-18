import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../utils/api';
import { Search, RefreshCw, Smartphone, Image as ImageIcon, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Templates() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [testingTemplate, setTestingTemplate] = useState<string | null>(null);

  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await apiFetch('/api/v1/templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const json = await res.json();
      return json.templates;
    },
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/v1/templates/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to sync templates');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(`Successfully synced ${data.count} templates from Meta`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Sync failed');
    }
  });

  const testMut = useMutation({
    mutationFn: async (templateName: string) => {
      const res = await apiFetch(`/api/v1/templates/${templateName}/test`, { method: 'POST' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to send test');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Test message dispatched successfully');
      setTestingTemplate(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Test dispatch failed');
      setTestingTemplate(null);
    }
  });

  const handleTest = (templateName: string) => {
    setTestingTemplate(templateName);
    testMut.mutate(templateName);
  };

  const filteredTemplates = templates.filter((t: any) => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20"><XCircle className="w-3.5 h-3.5" /> Rejected</span>;
      case 'PENDING':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"><Clock className="w-3.5 h-3.5" /> Pending</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20"><AlertTriangle className="w-3.5 h-3.5" /> {status}</span>;
    }
  };

  return (
    <div className="flex h-full flex-col relative animate-in fade-in slide-in-from-bottom-2 duration-300 bg-slate-950">
      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Smartphone className="text-indigo-500" /> WhatsApp Templates
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Manage your Meta-approved message templates. This is the source of truth for the Gateway.
          </p>
        </div>
        <button 
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          className="bg-indigo-600 text-white hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium inline-flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncMut.isPending ? 'animate-spin' : ''}`} />
          {syncMut.isPending ? 'Syncing...' : 'Sync from Meta'}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-auto">
        
        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search templates by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder:text-slate-500"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
            Failed to load templates. Try syncing from Meta.
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center border border-slate-800 border-dashed rounded-xl bg-slate-900/50">
            <Smartphone className="w-12 h-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No templates found</h3>
            <p className="text-slate-500 mt-1 text-sm max-w-md text-center">
              If you have created templates in the Meta Business Manager, click "Sync from Meta" to fetch them into the Gateway.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTemplates.map((template: any) => {
              const components = typeof template.components === 'string' ? JSON.parse(template.components) : template.components;
              const header = components.find((c: any) => c.type === 'HEADER');
              const body = components.find((c: any) => c.type === 'BODY');
              const isMedia = header && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(header.format);

              return (
                <div key={template.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors flex flex-col group">
                  <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/80">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-200 break-all">{template.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        {getStatusBadge(template.status)}
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-400 tracking-wider">
                          {template.language}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-400 tracking-wider">
                          {template.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 flex-1 text-sm text-slate-400 whitespace-pre-wrap font-mono relative">
                    {isMedia && (
                      <div className="mb-4 bg-slate-950 border border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center text-slate-500">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-xs uppercase tracking-wider font-semibold">{header.format} HEADER</span>
                      </div>
                    )}
                    {body?.text || <span className="italic opacity-50">No text body</span>}
                  </div>

                  <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Synced {new Date(template.lastSyncedAt).toLocaleDateString()}
                    </div>
                    <button
                      onClick={() => handleTest(template.name)}
                      disabled={testingTemplate === template.name || template.status !== 'APPROVED'}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                    >
                      {testingTemplate === template.name ? <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : null}
                      Send Test
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../utils/api';
import { Search, RefreshCw, Smartphone, Image as ImageIcon, CheckCircle, XCircle, Clock, AlertTriangle, X, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function Templates() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  // Form state
  const [formVariables, setFormVariables] = useState<Record<string, string>>({});
  const [formMedia, setFormMedia] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleOpenTestModal = (template: any) => {
    setSelectedTemplate(template);
    setFormVariables({});
    setFormMedia(null);
    setIsTestModalOpen(true);
  };

  const handleCloseTestModal = () => {
    setIsTestModalOpen(false);
    setSelectedTemplate(null);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    
    setIsSubmitting(true);
    try {
      let mediaBase64 = undefined;
      if (formMedia) {
        mediaBase64 = await fileToBase64(formMedia);
      }

      const components = typeof selectedTemplate.components === 'string' ? JSON.parse(selectedTemplate.components) : selectedTemplate.components;
      const body = components.find((c: any) => c.type === 'BODY');
      const matches = body?.text?.match(/\{\{(\d+)\}\}/g) || [];
      const variableCount = new Set(matches).size;
      
      const variablesArray = [];
      for (let i = 1; i <= variableCount; i++) {
        variablesArray.push(formVariables[i.toString()] || '');
      }

      const payload = {
        channel: 'whatsapp',
        recipient: '918744832318',
        template: selectedTemplate.name,
        language: selectedTemplate.language,
        source: 'gateway-dashboard-template-test',
        requestedBy: 'developer',
        variables: variablesArray,
        metadata: mediaBase64 ? { mediaBase64 } : {}
      };

      const res = await apiFetch('/api/v1/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || 'Failed to send test message');
      }

      toast.success('Test message dispatched successfully');
      handleCloseTestModal();
    } catch (err: any) {
      toast.error(err.message || 'Dispatch failed');
    } finally {
      setIsSubmitting(false);
    }
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
                      onClick={() => handleOpenTestModal(template)}
                      disabled={template.status !== 'APPROVED'}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                    >
                      Send Test
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Test Template Modal */}
      {isTestModalOpen && selectedTemplate && (() => {
        const components = typeof selectedTemplate.components === 'string' ? JSON.parse(selectedTemplate.components) : selectedTemplate.components;
        const header = components.find((c: any) => c.type === 'HEADER');
        const body = components.find((c: any) => c.type === 'BODY');
        const isMedia = header && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(header.format);
        
        const matches = body?.text?.match(/\{\{(\d+)\}\}/g) || [];
        const variableCount = new Set(matches).size;
        const variables = Array.from({ length: variableCount }, (_, i) => i + 1);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <h3 className="text-xl font-semibold text-white">Send Test Message</h3>
                <button onClick={handleCloseTestModal} className="text-slate-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <form id="test-form" onSubmit={handleSendTest} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Recipient</label>
                    <input 
                      type="text" 
                      value="918744832318" 
                      readOnly 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-400 cursor-not-allowed focus:outline-none"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">Test messages are fixed to this sandbox number.</p>
                  </div>

                  {isMedia && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Upload Header Media ({header.format})
                      </label>
                      <div className="relative group cursor-pointer">
                        <input 
                          type="file" 
                          required
                          accept={header.format === 'IMAGE' ? 'image/png,image/jpeg' : header.format === 'DOCUMENT' ? 'application/pdf' : 'video/mp4'}
                          onChange={(e) => setFormMedia(e.target.files?.[0] || null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors ${formMedia ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-950'}`}>
                          {formMedia ? (
                            <>
                              <CheckCircle className="w-8 h-8 text-indigo-500 mb-2" />
                              <p className="text-sm font-medium text-indigo-400">{formMedia.name}</p>
                              <p className="text-xs text-indigo-500/70 mt-1">Click to replace</p>
                            </>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-slate-600 mb-2 group-hover:text-slate-500 transition-colors" />
                              <p className="text-sm font-medium text-slate-400">Click or drag file to upload</p>
                              <p className="text-xs text-slate-500 mt-1">Accepts {header.format === 'IMAGE' ? 'PNG, JPG' : header.format === 'DOCUMENT' ? 'PDF' : 'MP4'}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {variables.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-4 flex items-center justify-between">
                        Template Variables
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-400">
                          {variables.length} Required
                        </span>
                      </label>
                      <div className="space-y-3 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                        {variables.map((v) => (
                          <div key={v}>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Variable {'{{'}{v}{'}}'}</label>
                            <input
                              type="text"
                              required
                              placeholder={`Value for {{${v}}}`}
                              value={formVariables[v.toString()] || ''}
                              onChange={(e) => setFormVariables(prev => ({ ...prev, [v.toString()]: e.target.value }))}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder:text-slate-600"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseTestModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="test-form"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {isSubmitting ? 'Sending...' : 'Send Test Message'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

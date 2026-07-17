import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { 
  Key, Plus, Trash2, ShieldAlert, Check, Copy, Power, PowerOff, RefreshCw, X, FileKey2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiFetch } from '../utils/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- API Fetchers ---
const API_BASE = '/api/v1/settings/api-keys';

const fetchApiKeys = async () => {
  const res = await apiFetch(API_BASE);
  if (!res.ok) throw new Error('Failed to fetch API keys');
  return res.json().then(data => data.apiKeys);
};

const createApiKey = async (data: any) => {
  const res = await apiFetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create API key');
  return res.json();
};

const deleteApiKey = async (id: number) => {
  const res = await apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete API key');
  return res.json();
};

const toggleApiKey = async ({ id, enabled }: { id: number; enabled: boolean }) => {
  const endpoint = enabled ? 'enable' : 'disable';
  const res = await apiFetch(`${API_BASE}/${id}/${endpoint}`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`Failed to ${endpoint} API key`);
  return res.json();
};

const regenerateApiKey = async (id: number) => {
  const res = await apiFetch(`${API_BASE}/${id}/regenerate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to regenerate API key');
  return res.json();
};

// --- Form Schema ---
const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  notes: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [generatedKeyData, setGeneratedKeyData] = useState<{ rawKey: string, name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: apiKeys = [], isLoading, isError, error } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: fetchApiKeys,
  });

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', notes: '' }
  });

  const createMut = useMutation({
    mutationFn: createApiKey,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setIsCreateModalOpen(false);
      setGeneratedKeyData({ rawKey: data.rawKey, name: data.apiKey.name });
      form.reset();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create API key')
  });

  const deleteMut = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API Key deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete API key')
  });

  const toggleMut = useMutation({
    mutationFn: toggleApiKey,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success(`API Key ${variables.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to toggle status')
  });

  const regenerateMut = useMutation({
    mutationFn: regenerateApiKey,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setGeneratedKeyData({ rawKey: data.rawKey, name: 'Regenerated Key' });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to regenerate API key')
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const closeGeneratedModal = () => {
    setGeneratedKeyData(null);
    setCopied(false);
  };

  const openCreateModal = () => {
    form.reset();
    setIsCreateModalOpen(true);
  };

  return (
    <div className="flex h-full flex-col relative animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage authentication keys for external integrations.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium inline-flex items-center gap-2 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 pt-0 overflow-auto">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
              Loading keys...
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                <ShieldAlert className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Failed to load API keys</h2>
              <p className="text-muted-foreground max-w-md mb-6 text-sm">
                Could not reach the API.
              </p>
              <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded max-w-md break-words">
                {(error as Error)?.message || 'Network Error'}
              </p>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-6">
                <FileKey2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No API keys found</h2>
              <p className="text-muted-foreground max-w-sm mb-6 text-sm">
                You haven't generated any API keys yet. Create one to allow external applications to authenticate with the Gateway.
              </p>
              <button 
                onClick={openCreateModal}
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm transition-colors"
              >
                Create API Key
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold border-b">
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Prefix</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4">Last Used</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apiKeys.map((key: any) => (
                    <tr key={key.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => toggleMut.mutate({ id: key.id, enabled: !key.enabled })}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                            key.enabled ? "bg-green-500/10 text-green-500 ring-green-500/20 hover:bg-green-500/20" : "bg-muted text-muted-foreground ring-border hover:bg-muted/80"
                          )}
                        >
                          {key.enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                          {key.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{key.name}</div>
                        {key.notes && <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate" title={key.notes}>{key.notes}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs flex items-center gap-2">
                          <span className="bg-muted px-2 py-1 rounded text-muted-foreground">{key.keyPrefix}••••••••</span>
                          <button onClick={() => handleCopy(key.keyPrefix)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(key.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {key.lastUsedAt ? (
                          <>
                            <div className="whitespace-nowrap">{new Date(key.lastUsedAt).toLocaleString()}</div>
                            {key.lastUsedIp && <div className="mt-0.5">IP: {key.lastUsedIp}</div>}
                          </>
                        ) : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              if (confirm('Are you sure you want to regenerate this key? The old key will immediately stop working.')) {
                                regenerateMut.mutate(key.id);
                              }
                            }}
                            className="p-2 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-md transition-colors"
                            title="Regenerate Key"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${key.name}? This cannot be undone.`)) {
                                deleteMut.mutate(key.id);
                              }
                            }}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="Delete Key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals & Overlays */}
      
      {/* Create Modal Overlay */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border shadow-2xl rounded-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" /> Create API Key
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={form.handleSubmit((v) => createMut.mutate(v))} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Key Name</label>
                <input 
                  {...form.register('name')}
                  placeholder="e.g. Kamna ERP Production"
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <input 
                  {...form.register('notes')}
                  placeholder="e.g. Used for outbound transactional messages"
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMut.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {createMut.isPending && <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />}
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Key Modal */}
      {generatedKeyData && (
        <div className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border shadow-2xl rounded-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-green-500/10 border-b border-green-500/20 p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4">
                <Check className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-green-500">API Key Generated</h2>
              <p className="text-sm text-green-500/80 mt-1">
                Please copy your new API key now.
              </p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md flex items-start gap-3 text-sm">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  <strong>For your security, this key will never be shown again.</strong><br/>
                  If you lose it, you will need to regenerate or create a new key.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Raw API Key</label>
                <div className="flex items-center gap-2">
                  <input 
                    readOnly
                    value={generatedKeyData.rawKey}
                    className="w-full bg-muted border border-border rounded-md px-4 py-3 font-mono text-sm focus:outline-none"
                  />
                  <button 
                    onClick={() => handleCopy(generatedKeyData.rawKey)}
                    className="p-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={closeGeneratedModal}
                  className="px-6 py-2 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-md text-sm font-medium transition-colors"
                >
                  I have copied the key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

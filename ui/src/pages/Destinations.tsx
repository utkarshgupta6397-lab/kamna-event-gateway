import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { 
  Plus, Edit2, Trash2, X, MapPin, Power, PowerOff, Save, Key, Network,
  Server, Shield
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- API Fetchers ---
const API_BASE = '/api/v1/destinations';

const fetchDestinations = async () => {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error('Failed to fetch destinations');
  return res.json().then(data => data.destinations);
};

const createDestination = async (data: any) => {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
};

const updateDestination = async ({ id, data }: { id: number; data: any }) => {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
};

const deleteDestination = async (id: number) => {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
};

// --- Validation Schema ---
const authSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('bearer'), token: z.string().min(1, 'Token is required') }),
  z.object({ 
    type: z.literal('basic'), 
    username: z.string().min(1, 'Username is required'), 
    password: z.string().min(1, 'Password is required') 
  }),
]);

const destinationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  type: z.enum(['webhook', 'kafka', 'http']),
  url: z.string().url('Must be a valid URL'),
  enabled: z.boolean(),
  priority: z.number().int().min(0, 'Priority must be 0 or greater'),
  timeoutMs: z.number().int().min(100, 'Timeout must be at least 100ms'),
  headers: z.array(z.object({
    key: z.string().min(1, 'Key is required'),
    value: z.string().min(1, 'Value is required'),
  })).optional(),
  auth: authSchema,
});

type DestinationFormValues = z.infer<typeof destinationSchema>;

export default function Destinations() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ['destinations'],
    queryFn: fetchDestinations,
  });

  const createMut = useMutation({
    mutationFn: createDestination,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      setDrawerOpen(false);
      toast.success('Destination created successfully');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create destination')
  });

  const updateMut = useMutation({
    mutationFn: updateDestination,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      setDrawerOpen(false);
      toast.success('Destination updated successfully');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update destination')
  });

  const deleteMut = useMutation({
    mutationFn: deleteDestination,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      toast.success('Destination deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete destination')
  });

  const toggleStatusMut = useMutation({
    mutationFn: updateDestination,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      toast.success(`Destination ${data.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to toggle status')
  });

  // --- Form Setup ---
  const form = useForm<DestinationFormValues>({
    resolver: zodResolver(destinationSchema),
    defaultValues: {
      name: '',
      type: 'webhook',
      url: '',
      enabled: true,
      priority: 0,
      timeoutMs: 5000,
      headers: [],
      auth: { type: 'none' },
    }
  });

  const { fields: headerFields, append: appendHeader, remove: removeHeader } = useFieldArray({
    control: form.control,
    name: 'headers'
  });

  const authType = form.watch('auth.type');

  const openDrawer = (dest?: any) => {
    form.reset();
    if (dest) {
      setEditingId(dest.id);
      
      // Transform API headers object to array format for UI
      const headersArray = dest.headers 
        ? Object.entries(dest.headers).map(([key, value]) => ({ key, value: String(value) }))
        : [];

      // Transform Auth format
      let authConfig = { type: 'none' as const };
      if (dest.authentication) {
        authConfig = dest.authentication;
      }

      form.reset({
        name: dest.name,
        type: dest.type,
        url: dest.url,
        enabled: dest.enabled,
        priority: dest.priority,
        timeoutMs: dest.timeoutMs,
        headers: headersArray,
        auth: authConfig as any,
      });
    } else {
      setEditingId(null);
    }
    setDrawerOpen(true);
  };

  const onSubmit = (values: DestinationFormValues) => {
    // Transform headers array back to Record<string,string>
    let headersObj: Record<string, string> | null = null;
    if (values.headers && values.headers.length > 0) {
      headersObj = {};
      values.headers.forEach(h => { headersObj![h.key] = h.value; });
    }

    // Transform Auth back to backend format
    const authObj = values.auth.type === 'none' ? null : values.auth;

    const payload = {
      ...values,
      headers: headersObj,
      authentication: authObj,
    };
    
    // Clean up temporary UI fields
    delete (payload as any).auth;

    if (editingId) {
      updateMut.mutate({ id: editingId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => form.reset(), 300); // Wait for transition
  };

  return (
    <div className="flex h-full flex-col relative animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Destinations</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage where events are delivered.</p>
        </div>
        <button 
          onClick={() => openDrawer()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium inline-flex items-center gap-2 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Destination
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 pt-0 overflow-auto">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
              Loading registry...
            </div>
          ) : destinations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-6">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No destinations registered</h2>
              <p className="text-muted-foreground max-w-sm mb-6 text-sm">
                The gateway needs at least one destination to forward incoming events. Create your first destination to get started.
              </p>
              <button 
                onClick={() => openDrawer()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm transition-colors"
              >
                Add Destination
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold border-b">
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Destination</th>
                    <th className="px-6 py-4">Endpoint</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Auth</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {destinations.map((dest: any) => (
                    <tr key={dest.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => toggleStatusMut.mutate({ id: dest.id, data: { enabled: !dest.enabled } })}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                            dest.enabled ? "bg-green-500/10 text-green-500 ring-green-500/20 hover:bg-green-500/20" : "bg-muted text-muted-foreground ring-border hover:bg-muted/80"
                          )}
                        >
                          {dest.enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                          {dest.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{dest.name}</div>
                        <div className="text-xs text-muted-foreground uppercase flex items-center gap-1 mt-0.5">
                          {dest.type === 'webhook' && <Network className="w-3 h-3" />}
                          {dest.type}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs truncate max-w-xs" title={dest.url}>
                          {dest.url}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                          {dest.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {dest.authentication ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md">
                            <Shield className="w-3 h-3" />
                            {dest.authentication.type}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openDrawer(dest)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                            title="Edit Configuration"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this destination?')) {
                                deleteMut.mutate(dest.id);
                              }
                            }}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="Delete Destination"
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

      {/* Slide-over Drawer Overlay */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity" 
          onClick={closeDrawer}
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div 
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l shadow-2xl transition-transform duration-300 ease-in-out sm:w-[480px] flex flex-col",
          drawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold tracking-tight">
            {editingId ? 'Edit Destination' : 'New Destination'}
          </h2>
          <button 
            onClick={closeDrawer}
            className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="dest-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* General Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">General</h3>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input 
                  {...form.register('name')}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="e.g. Production Billing Webhook"
                />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Transport Type</label>
                  <select 
                    {...form.register('type')}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="webhook">Webhook (POST)</option>
                    <option value="http">Raw HTTP</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select 
                    {...form.register('enabled', { setValueAs: v => v === 'true' })}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Endpoint URL</label>
                <input 
                  {...form.register('url')}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="https://api.example.com/webhooks"
                />
                {form.formState.errors.url && <p className="text-xs text-destructive">{form.formState.errors.url.message}</p>}
              </div>
            </div>

            <hr className="border-border" />

            {/* Execution Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Server className="w-4 h-4" /> Execution Limits
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority (Higher is first)</label>
                  <input 
                    type="number"
                    {...form.register('priority', { valueAsNumber: true })}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timeout (ms)</label>
                  <input 
                    type="number"
                    {...form.register('timeoutMs', { valueAsNumber: true })}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {form.formState.errors.timeoutMs && <p className="text-xs text-destructive">{form.formState.errors.timeoutMs.message}</p>}
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* Authentication Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Key className="w-4 h-4" /> Authentication
              </h3>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Auth Strategy</label>
                <select 
                  {...form.register('auth.type')}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="none">No Authentication</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                </select>
              </div>

              {authType === 'bearer' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <label className="text-sm font-medium">Token</label>
                  <input 
                    type="password"
                    {...form.register('auth.token')}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="sk_live_..."
                  />
                  {form.formState.errors.auth && 'token' in (form.formState.errors.auth as any) && (
                    <p className="text-xs text-destructive">{(form.formState.errors.auth as any).token?.message}</p>
                  )}
                </div>
              )}

              {authType === 'basic' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username</label>
                    <input 
                      {...form.register('auth.username')}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <input 
                      type="password"
                      {...form.register('auth.password')}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Custom Headers Section */}
            <div className="space-y-4 pb-12">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Network className="w-4 h-4" /> Static Headers
                </h3>
                <button 
                  type="button" 
                  onClick={() => appendHeader({ key: '', value: '' })}
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  + Add Header
                </button>
              </div>

              {headerFields.length === 0 ? (
                <div className="text-center p-4 border border-dashed rounded-md bg-muted/30">
                  <p className="text-xs text-muted-foreground">No custom headers injected.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {headerFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2">
                      <div className="flex-1 space-y-1">
                        <input 
                          {...form.register(`headers.${index}.key`)}
                          placeholder="Header Name"
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        {form.formState.errors.headers?.[index]?.key && (
                          <p className="text-[10px] text-destructive">{form.formState.errors.headers[index]?.key?.message}</p>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <input 
                          {...form.register(`headers.${index}.value`)}
                          placeholder="Value"
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        {form.formState.errors.headers?.[index]?.value && (
                          <p className="text-[10px] text-destructive">{form.formState.errors.headers[index]?.value?.message}</p>
                        )}
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeHeader(index)}
                        className="p-2 mt-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </form>
        </div>

        <div className="border-t bg-muted/20 p-6 flex justify-end gap-3">
          <button 
            type="button"
            onClick={closeDrawer}
            className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="dest-form"
            disabled={createMut.isPending || updateMut.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {createMut.isPending || updateMut.isPending ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {editingId ? 'Save Changes' : 'Create Destination'}
          </button>
        </div>
      </div>
    </div>
  );
}

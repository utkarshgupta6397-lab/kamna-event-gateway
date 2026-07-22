import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Save, CheckCircle2, XCircle, Zap, Shield, Key, HelpCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function ProvidersSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [config, setConfig] = useState({
    enabled: false,
    isDefault: true,
    settings: {
      apiVersion: 'v19.0',
      phoneNumberId: '',
      businessAccountId: '',
      defaultTemplate: 'hello_world',
      defaultLanguage: 'en_US',
      testPhoneNumber: '',
      accessToken: '',
      appSecret: '',
      verifyToken: '',
      webhookVerified: false,
      lastVerificationAt: null as string | null,
    }
  });

  const [lastConnection, setLastConnection] = useState<any>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const generateVerifyToken = async () => {
    setGenerating(true);
    try {
      const res = await apiFetch('/api/v1/providers/whatsapp/generate-verify-token', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        updateSetting('verifyToken', data.verifyToken);
        updateSetting('webhookVerified', false); // Needs re-verification
      }
    } catch (e) {
      toast.error('Failed to generate token');
    } finally {
      setGenerating(false);
    }
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/providers/whatsapp');
      if (res.ok) {
        const data = await res.json();
        if (data.configured) {
          setConfig({
            enabled: data.enabled,
            isDefault: data.isDefault,
            settings: {
              apiVersion: data.settings.apiVersion || 'v19.0',
              phoneNumberId: data.settings.phoneNumberId || '',
              businessAccountId: data.settings.businessAccountId || '',
              defaultTemplate: data.settings.defaultTemplate || 'hello_world',
              defaultLanguage: data.settings.defaultLanguage || 'en_US',
              testPhoneNumber: data.settings.testPhoneNumber || '',
              accessToken: data.settings.encryptedAccessToken ? '********' : '',
              appSecret: data.settings.appSecret ? '********' : '',
              verifyToken: data.settings.verifyToken || '',
              webhookVerified: data.settings.webhookVerified || false,
              lastVerificationAt: data.settings.lastVerificationAt || null,
            }
          });
          
          if (!data.settings.verifyToken) {
            generateVerifyToken();
          }
        } else {
          // If not configured at all, auto-generate token
          generateVerifyToken();
        }
      }
    } catch (e) {
      toast.error('Failed to load provider configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateToken = () => {
    if (window.confirm("Regenerating the token will break your existing Meta Webhook connection until you update it in the Meta App Dashboard. Are you sure?")) {
      generateVerifyToken();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/providers/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        toast.success('Configuration saved securely.');
        fetchConfig(); // Reload to get masked token
      } else {
        toast.error('Failed to save configuration.');
      }
    } catch (e) {
      toast.error('Error saving configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await apiFetch('/api/v1/providers/whatsapp/test', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Connection successful!');
        setLastConnection({ status: 'success', time: new Date() });
      } else {
        toast.error(`Connection failed: ${data.error}`);
        setLastConnection({ status: 'error', error: data.error, time: new Date() });
      }
    } catch (e: any) {
      toast.error('Connection test failed.');
      setLastConnection({ status: 'error', error: e.message, time: new Date() });
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestTemplate = async () => {
    if (!config.settings.testPhoneNumber) {
      toast.error('Please configure a Test Phone Number first.');
      return;
    }
    setSending(true);
    try {
      const response = await apiFetch('/api/v1/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'whatsapp',
          recipient: config.settings.testPhoneNumber,
          template: config.settings.defaultTemplate || 'hello_world',
          variables: {},
          source: 'gateway-dashboard-test',
          requestedBy: 'admin'
        })
      });
      if (response.ok) {
        toast.success('Test template queued successfully! Check Observatory.');
      } else {
        const data = await response.json();
        toast.error(`Failed to send: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      toast.error('Failed to send test message');
    } finally {
      setSending(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      settings: { ...prev.settings, [key]: value }
    }));
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading Configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Meta WhatsApp Configuration</h2>
          <p className="text-sm text-slate-400 mt-1">Manage connection settings for WhatsApp Cloud API.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm"
        >
          {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
          Save Configuration
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Connection Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
              <Zap size={18} className="text-indigo-400" />
              <h3 className="font-semibold text-slate-200">Connection</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-200">Provider Enabled</p>
                  <p className="text-sm text-slate-500">Allow outbound messages through this provider.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-200">Default Provider</p>
                  <p className="text-sm text-slate-500">Use as the default transport for WhatsApp.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={config.isDefault} onChange={e => setConfig({ ...config, isDefault: e.target.checked })} />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Graph API Version</label>
                <input type="text" value={config.settings.apiVersion} onChange={e => updateSetting('apiVersion', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="v19.0" />
              </div>
            </div>
          </div>

          {/* Credentials */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
              <Shield size={18} className="text-amber-400" />
              <h3 className="font-semibold text-slate-200">Secure Credentials</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                  Access Token <Key size={12} className="text-amber-500" />
                </label>
                <input 
                  type="password" 
                  value={config.settings.accessToken} 
                  onChange={e => updateSetting('accessToken', e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono" 
                  placeholder="EAA..." 
                />
                <p className="text-xs text-slate-500 mt-1">This value is encrypted securely in the database before persistence.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                  App Secret <Key size={12} className="text-amber-500" />
                </label>
                <input 
                  type="password" 
                  value={config.settings.appSecret} 
                  onChange={e => updateSetting('appSecret', e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono" 
                  placeholder="Required for Webhook Signature Verification" 
                />
                <p className="text-xs text-slate-500 mt-1">This value is encrypted securely in the database before persistence.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number ID</label>
                  <input type="text" value={config.settings.phoneNumberId} onChange={e => updateSetting('phoneNumberId', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">WhatsApp Business Account ID</label>
                  <input type="text" value={config.settings.businessAccountId} onChange={e => updateSetting('businessAccountId', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono" />
                </div>
              </div>
            </div>
          </div>

          {/* Webhook Configuration */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
              <Zap size={18} className="text-pink-400" />
              <h3 className="font-semibold text-slate-200">Webhook Configuration</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Verify Token</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type={showToken ? "text" : "password"}
                        readOnly 
                        value={config.settings.verifyToken} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-4 pr-10 py-2 text-sm text-slate-300 font-mono focus:outline-none" 
                        placeholder="Loading..." 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(config.settings.verifyToken); toast.success('Copied Token'); }} className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors" title="Copy Token">Copy</button>
                    <button onClick={handleRegenerateToken} disabled={generating} className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 rounded-lg text-sm transition-colors" title="Regenerate Token"><RefreshCw size={16} className={generating ? 'animate-spin' : ''} /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Webhook URL</label>
                  <div className="flex gap-2">
                    <input type="text" readOnly value={`${window.location.origin}/api/v1/webhooks/meta`} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-500 font-mono focus:outline-none" />
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/v1/webhooks/meta`); toast.success('Copied URL'); }} className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">Copy</button>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${config.settings.webhookVerified ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800/50 text-slate-400 border border-slate-700'}`}>
                  {config.settings.webhookVerified ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" /> : <HelpCircle size={16} className="mt-0.5 flex-shrink-0" />}
                  <div>
                    <p className="font-semibold">{config.settings.webhookVerified ? 'Webhook Verified' : 'Webhook Not Verified Yet'}</p>
                    <p className="opacity-80 mt-1">{config.settings.webhookVerified ? `Last successful verification from Meta: ${new Date(config.settings.lastVerificationAt!).toLocaleString()}` : 'Configure the Webhook URL and Verify Token in your Meta App Dashboard.'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Testing */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <h3 className="font-semibold text-slate-200">Testing & Validation</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Default Template Name</label>
                  <input type="text" value={config.settings.defaultTemplate} onChange={e => updateSetting('defaultTemplate', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Default Language</label>
                  <input type="text" value={config.settings.defaultLanguage} onChange={e => updateSetting('defaultLanguage', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono" />
                </div>
              </div>
              
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Test Phone Number (incl. country code)</label>
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    value={config.settings.testPhoneNumber} 
                    onChange={e => updateSetting('testPhoneNumber', e.target.value)} 
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono" 
                    placeholder="919876543210" 
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    onClick={handleSendTestTemplate}
                    disabled={sending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
                  >
                    {sending ? 'Sending...' : `Send ${config.settings.defaultTemplate} Template`}
                  </button>
                </div>
              </div>

              {lastConnection && (
                <div className={`mt-4 p-4 rounded-lg text-sm flex items-start gap-3 ${lastConnection.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {lastConnection.status === 'success' ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" /> : <XCircle size={16} className="mt-0.5 flex-shrink-0" />}
                  <div>
                    <p className="font-semibold">{lastConnection.status === 'success' ? 'Connection Successful' : 'Connection Failed'}</p>
                    <p className="opacity-80 mt-1">{lastConnection.status === 'error' ? lastConnection.error : `Verified at ${lastConnection.time.toLocaleTimeString()}`}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
              <HelpCircle size={18} className="text-blue-400" />
              <h3 className="font-semibold text-slate-200">Where do I find these?</h3>
            </div>
            <div className="p-6 space-y-4 text-sm text-slate-400">
              <div>
                <p className="font-medium text-slate-200">Access Token</p>
                <p className="mt-1">Meta Developers → My Apps → Your App → WhatsApp → API Setup → Temporary/Permanent Access Token</p>
              </div>
              <div className="pt-4 border-t border-slate-800/50">
                <p className="font-medium text-slate-200">Phone Number ID</p>
                <p className="mt-1">Meta Developers → WhatsApp → API Setup → Phone Number ID</p>
              </div>
              <div className="pt-4 border-t border-slate-800/50">
                <p className="font-medium text-slate-200">WhatsApp Business Account ID</p>
                <p className="mt-1">Meta Developers → WhatsApp → API Setup → WhatsApp Business Account ID</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../utils/api';
import {
  Search, MessageSquare, Clock, Check, CheckCheck, AlertCircle,
  CornerDownLeft, FileText, Terminal, Copy, X, Send,
  Paperclip, Smile, ChevronDown, ExternalLink, Zap,
  Inbox, AlertTriangle, CalendarDays,
  File, Download, Play, Pause, MapPin, User, Phone,
  PanelRightClose, PanelRightOpen, ChevronUp,
  Image as ImageIcon, Link as LinkIcon, Maximize2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

/* ─────────── Types ─────────── */
interface ConversationSummary {
  recipient: string;
  customerName: string;
  channel: string;
  lastActivity: string;
  lastMessage: {
    id: string;
    direction: 'OUTGOING' | 'INCOMING';
    text: string;
    template?: string;
    status: string;
    timestamp: string;
  };
  messagesCount: number;
  unread: boolean;
}

interface ChatMessage {
  id: string;
  dbId?: number;
  messageId?: string;
  eventId?: string;
  direction: 'OUTGOING' | 'INCOMING';
  recipient: string;
  sender?: string;
  waId?: string;
  channel?: string;
  template?: string;
  variables?: any;
  metadata?: any;
  status: string;
  provider?: string;
  providerMessageId?: string;
  providerStatus?: string;
  providerResponse?: any;
  providerLatency?: number;
  providerHttpStatus?: number;
  requestedBy?: string;
  source?: string;
  createdAt?: string;
  acceptedAt?: string;
  timestamp: string;
  timeline?: any[];
  text?: string;
  messageType?: string;
  rawPayload?: any;
}

interface TemplateDefinition {
  id: number;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any;
}

type ConvFilter = 'all' | 'unread' | 'failed' | 'today';
type InspectorTab = 'overview' | 'timeline' | 'payload' | 'webhooks' | 'metadata';
type GalleryTab = 'media' | 'documents' | 'links';

/* ─────────── Helpers ─────────── */
const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const AVATAR_COLORS = [
  'from-emerald-600 to-teal-700',
  'from-indigo-600 to-violet-700',
  'from-blue-600 to-cyan-700',
  'from-rose-600 to-pink-700',
  'from-amber-600 to-orange-700',
  'from-purple-600 to-fuchsia-700',
];
const getAvatarColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const formatSmartDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (ts: string) => {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatRelative = (ts: string) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  if (isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/* ─────────── Template Reconstruction ─────────── */
function reconstructTemplate(templateDef: TemplateDefinition | undefined, variables?: any) {
  if (!templateDef || !templateDef.components) return null;
  try {
    const components = typeof templateDef.components === 'string'
      ? JSON.parse(templateDef.components)
      : templateDef.components;

    if (!Array.isArray(components)) return null;

    const varArray: string[] = Array.isArray(variables)
      ? variables
      : typeof variables === 'object' && variables !== null
      ? Object.values(variables)
      : [];

    let globalVarIdx = 0;
    const replaceVars = (text?: string) => {
      if (!text) return '';
      return text.replace(/\{\{(\d+)\}\}/g, (_match, p1) => {
        const idx = parseInt(p1, 10) - 1;
        if (varArray[idx] !== undefined) return String(varArray[idx]);
        if (varArray[globalVarIdx] !== undefined) {
          const val = String(varArray[globalVarIdx]);
          globalVarIdx++;
          return val;
        }
        return `{{${p1}}}`;
      });
    };

    const headerComp = components.find((c: any) => c.type === 'HEADER');
    const bodyComp = components.find((c: any) => c.type === 'BODY');
    const footerComp = components.find((c: any) => c.type === 'FOOTER');
    const buttonsComp = components.find((c: any) => c.type === 'BUTTONS');

    return {
      headerFormat: headerComp?.format || (headerComp?.text ? 'TEXT' : undefined),
      headerText: headerComp?.text ? replaceVars(headerComp.text) : undefined,
      bodyText: bodyComp?.text ? replaceVars(bodyComp.text) : undefined,
      footerText: footerComp?.text ? replaceVars(footerComp.text) : undefined,
      buttons: buttonsComp?.buttons || [],
    };
  } catch (_e) {
    return null;
  }
}

/* ─────────── Main Component ─────────── */
export default function Communications() {
  const [searchQuery, setSearchQuery] = useState('');
  const [convFilter, setConvFilter] = useState<ConvFilter>('all');
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  
  /* In-chat message search state */
  const [isSearchInChatOpen, setIsSearchInChatOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchMatchIndex, setChatSearchMatchIndex] = useState(0);

  /* Lightbox & Gallery state */
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState<GalleryTab>('media');

  /* Debug report state */
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  /* Audio state simulation */
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  /* ── Fetch Conversations ── */
  const { data: conversationsData, isLoading: isLoadingConversations, refetch: refetchConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const r = await apiFetch('/api/v1/messages/conversations');
      if (!r.ok) throw new Error('Failed to fetch conversations');
      return ((await r.json()).conversations || []) as ConversationSummary[];
    },
    refetchInterval: 4000,
  });
  const conversations = useMemo(() => conversationsData || [], [conversationsData]);

  /* Auto select first conversation */
  useEffect(() => {
    if (conversations.length > 0 && !selectedRecipient) {
      setSelectedRecipient(conversations[0].recipient);
    }
  }, [conversations, selectedRecipient]);

  /* ── Fetch Chat Messages ── */
  const { data: chatData, isLoading: isLoadingChat } = useQuery({
    queryKey: ['conversationMessages', selectedRecipient],
    queryFn: async () => {
      if (!selectedRecipient) return [];
      const r = await apiFetch(`/api/v1/messages/conversations/${selectedRecipient}`);
      if (!r.ok) throw new Error('Failed to fetch messages');
      return ((await r.json()).messages || []) as ChatMessage[];
    },
    enabled: !!selectedRecipient,
    refetchInterval: 3000,
  });
  const chatMessages = useMemo(() => chatData || [], [chatData]);

  /* ── Fetch Templates definitions for reconstruction ── */
  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const r = await apiFetch('/api/v1/templates');
      if (!r.ok) return [];
      return ((await r.json()).templates || []) as TemplateDefinition[];
    },
  });
  const templatesMap = useMemo(() => {
    const map = new Map<string, TemplateDefinition>();
    if (templatesData) {
      templatesData.forEach(t => map.set(t.name, t));
    }
    return map;
  }, [templatesData]);

  /* Selected active conversation */
  const activeConv = conversations.find(c => c.recipient === selectedRecipient);

  /* Active selected message for Inspector */
  const selectedMessage = useMemo(() => {
    if (selectedMessageId) {
      return chatMessages.find(m => m.id === selectedMessageId);
    }
    // Default to last outgoing or last message if none selected
    return chatMessages[chatMessages.length - 1];
  }, [chatMessages, selectedMessageId]);

  /* ── Auto-scroll to bottom ── */
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    chatEndRef.current?.scrollIntoView({ behavior });
  }, []);

  /* Automatically scroll to newest message when selecting/changing conversation */
  useEffect(() => {
    setIsAtBottom(true);
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedRecipient]);

  /* Stay pinned to bottom on new messages only if already at bottom */
  useEffect(() => {
    if (isAtBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAtBottom]);

  /* ── Filtering Conversations ── */
  const filteredConversations = conversations.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      c.recipient.toLowerCase().includes(q) ||
      c.customerName.toLowerCase().includes(q) ||
      (c.lastMessage.text || '').toLowerCase().includes(q) ||
      (c.lastMessage.template || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (convFilter === 'unread') return c.unread;
    if (convFilter === 'failed') return c.lastMessage.status === 'FAILED';
    if (convFilter === 'today') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return new Date(c.lastActivity) >= today;
    }
    return true;
  });

  /* ── In-Chat Search Matches ── */
  const searchMatches = useMemo(() => {
    if (!chatSearchQuery.trim()) return [];
    const q = chatSearchQuery.toLowerCase();
    return chatMessages.filter(m => {
      const text = (m.text || '').toLowerCase();
      const template = (m.template || '').toLowerCase();
      const vars = (Array.isArray(m.variables) ? m.variables.join(' ') : '').toLowerCase();
      return text.includes(q) || template.includes(q) || vars.includes(q);
    });
  }, [chatMessages, chatSearchQuery]);

  useEffect(() => {
    if (searchMatches.length > 0 && chatSearchMatchIndex < searchMatches.length) {
      const targetMsg = searchMatches[chatSearchMatchIndex];
      const el = document.getElementById(`msg-${targetMsg.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [chatSearchMatchIndex, searchMatches]);

  /* ── Message Date Grouping ── */
  const groupMessagesByDate = (msgs: ChatMessage[]) => {
    const groups: [string, ChatMessage[]][] = [];
    let currentDate = '';
    msgs.forEach(msg => {
      const d = new Date(msg.timestamp);
      const key = isNaN(d.getTime()) ? 'Unknown' : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (key !== currentDate) {
        currentDate = key;
        groups.push([msg.timestamp, []]);
      }
      groups[groups.length - 1][1].push(msg);
    });
    return groups;
  };

  /* ── Debug Report Generator ── */
  const generateDebugReport = async () => {
    if (!selectedMessage) {
      toast.error('No message selected for debug report');
      return;
    }
    setIsGeneratingReport(true);
    try {
      let webhooks: any[] = [];
      if (selectedMessage.messageId) {
        const r = await apiFetch(`/api/v1/webhook-inspector?search=${selectedMessage.messageId}&limit=100`);
        if (r.ok) {
          const j = await r.json();
          webhooks = j.data || [];
        }
      }

      const finalPayload = selectedMessage.timeline?.find((t: any) => t.description === 'Template Sent')?.metadata?.payload || {};

      let report = `# Kamna Gateway Debug Report\n\n`;
      report += `## Business Summary\n`;
      report += `- **Recipient:** ${selectedMessage.recipient}\n`;
      report += `- **Direction:** ${selectedMessage.direction}\n`;
      report += `- **Channel:** ${selectedMessage.channel || 'whatsapp'}\n`;
      report += `- **Template Name:** ${selectedMessage.template || 'N/A'}\n`;
      report += `- **Status:** **${selectedMessage.status}**\n`;
      report += `- **Timestamp:** ${new Date(selectedMessage.createdAt || selectedMessage.timestamp).toLocaleString()}\n\n`;

      report += `## Communication Details\n`;
      report += `| Key | Value |\n|---|---|\n`;
      report += `| Message ID | \`${selectedMessage.messageId || selectedMessage.id}\` |\n`;
      report += `| Event ID | \`${selectedMessage.eventId || 'N/A'}\` |\n`;
      report += `| Provider | ${selectedMessage.provider || 'Meta WhatsApp'} |\n`;
      report += `| Provider Message ID | \`${selectedMessage.providerMessageId || 'N/A'}\` |\n`;
      report += `| Provider Status | ${selectedMessage.providerStatus || 'N/A'} |\n`;
      report += `| HTTP Status Code | ${selectedMessage.providerHttpStatus || 'N/A'} |\n`;
      report += `| Latency | ${selectedMessage.providerLatency ? selectedMessage.providerLatency + 'ms' : 'N/A'} |\n`;
      report += `| Requested By | ${selectedMessage.requestedBy || 'N/A'} |\n`;
      report += `| Source | ${selectedMessage.source || 'N/A'} |\n\n`;

      if (selectedMessage.variables) {
        report += `## Variables\n\`\`\`json\n${JSON.stringify(selectedMessage.variables, null, 2)}\n\`\`\`\n\n`;
      }

      report += `## Delivery Timeline\n`;
      if (selectedMessage.timeline && selectedMessage.timeline.length > 0) {
        report += `| Time | Status | Description |\n|---|---|---|\n`;
        selectedMessage.timeline.forEach((t: any) => {
          report += `| ${new Date(t.createdAt).toLocaleTimeString()} | ${t.status} | ${t.description} |\n`;
        });
        report += `\n`;
      } else {
        report += `*No timeline entries recorded.*\n\n`;
      }

      report += `## Final Payload\n\`\`\`json\n${JSON.stringify(finalPayload, null, 2)}\n\`\`\`\n\n`;

      report += `## Provider Response\n\`\`\`json\n${JSON.stringify(selectedMessage.providerResponse || {}, null, 2)}\n\`\`\`\n\n`;

      if (webhooks.length > 0) {
        report += `## Webhook Events\n`;
        report += `| Received At | Event Type | Status | Error |\n|---|---|---|---|\n`;
        webhooks.forEach((w: any) => {
          report += `| ${w.receivedAt ? new Date(w.receivedAt).toLocaleString() : 'N/A'} | ${w.eventType || '?'} | ${w.processingStatus} | ${w.errorMessage || 'None'} |\n`;
        });
        report += `\n`;
      }

      if (selectedMessage.metadata) {
        report += `## Metadata\n\`\`\`json\n${JSON.stringify(selectedMessage.metadata, null, 2)}\n\`\`\`\n\n`;
      }

      report += `---\n*Generated by Kamna Gateway Conversation Center • ${new Date().toLocaleString()}*\n`;

      await navigator.clipboard.writeText(report);
      toast.success('AI-friendly Debug Report copied to clipboard');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate debug report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  /* ── Status Ticks Helper ── */
  const StatusTickIcon = ({ status, size = 15 }: { status: string; size?: number }) => {
    switch (status) {
      case 'QUEUED': case 'VALIDATED': case 'PROCESSING':
        return <span title="Queued"><Clock size={size} className="text-slate-400" /></span>;
      case 'SENDING': case 'META_ACCEPTED':
        return <span title="Sending"><Check size={size} className="text-slate-400" /></span>;
      case 'SENT':
        return <span title="Sent"><Check size={size} className="text-slate-400" /></span>;
      case 'DELIVERED':
        return <span title="Delivered"><CheckCheck size={size} className="text-slate-400" /></span>;
      case 'READ':
        return <span title="Read"><CheckCheck size={size} className="text-sky-400" /></span>;
      case 'REPLIED':
        return <span title="Replied"><CornerDownLeft size={size} className="text-emerald-400" /></span>;
      case 'FAILED':
        return <span title="Failed"><AlertCircle size={size} className="text-rose-400" /></span>;
      default:
        return <Check size={size} className="text-slate-400" />;
    }
  };

  /* ── Filter Chips Configuration ── */
  const FILTERS: { key: ConvFilter; label: string; icon: any }[] = [
    { key: 'all', label: 'All', icon: Inbox },
    { key: 'unread', label: 'Unread', icon: MessageSquare },
    { key: 'failed', label: 'Failed', icon: AlertTriangle },
    { key: 'today', label: 'Today', icon: CalendarDays },
  ];

  /* ── Inspector Tabs Configuration ── */
  const INSPECTOR_TABS: { key: InspectorTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'payload', label: 'Payload' },
    { key: 'webhooks', label: 'Webhooks' },
    { key: 'metadata', label: 'Metadata' },
  ];

  /* Grouped Messages */
  const groupedMessages = groupMessagesByDate(chatMessages);

  /* Extract media for gallery */
  const galleryItems = useMemo(() => {
    const media: any[] = [];
    const docs: any[] = [];
    const links: any[] = [];

    chatMessages.forEach(msg => {
      const type = msg.messageType?.toLowerCase() || '';
      if (type === 'image' || type === 'video' || msg.metadata?.mediaUrl) {
        media.push(msg);
      } else if (type === 'document' || msg.metadata?.documentName) {
        docs.push(msg);
      }

      // Check text or variables for links
      const textToScan = `${msg.text || ''} ${Array.isArray(msg.variables) ? msg.variables.join(' ') : ''}`;
      const urlMatches = textToScan.match(/https?:\/\/[^\s]+/g);
      if (urlMatches) {
        urlMatches.forEach(url => links.push({ url, msg }));
      }
    });

    return { media, docs, links };
  }, [chatMessages]);

  return (
    <div className="h-full w-full flex bg-[#0b141a] text-slate-200 overflow-hidden font-sans select-none flex-1 min-h-0">

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* COLUMN 1 — CONVERSATION LIST (320px)                              */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <div className="w-[320px] flex-none flex flex-col border-r border-slate-800/70 bg-[#111b21] z-20 h-full overflow-hidden">

        {/* Top Header */}
        <div className="p-3 bg-[#202c33] border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md font-bold text-xs">
              KG
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 leading-none">Chats</h1>
              <span className="text-[10px] text-emerald-400 font-medium">WhatsApp Gateway</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refetchConversations()}
              className="p-1.5 rounded-full hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3 pt-3 pb-2 bg-[#111b21]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#202c33] border border-transparent focus:border-emerald-500/50 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scrollbar-none pb-0.5">
            {FILTERS.map(f => {
              const Icon = f.icon;
              const active = convFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setConvFilter(f.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    active
                      ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 shadow-sm'
                      : 'bg-[#202c33] text-slate-400 border border-transparent hover:text-slate-200 hover:bg-[#2a3942]'
                  }`}
                >
                  <Icon size={12} />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/30">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-16 text-center text-slate-500 text-xs">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
              <p>No conversations found</p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = conv.recipient === selectedRecipient;
              const displayName = conv.customerName !== conv.recipient ? conv.customerName : conv.recipient;
              const avatarGrad = getAvatarColor(conv.recipient);
              const initials = getInitials(displayName);
              const isFailed = conv.lastMessage?.status === 'FAILED';

              /* Reconstruct last message text preview */
              const templateDef = conv.lastMessage?.template ? templatesMap.get(conv.lastMessage.template) : undefined;
              const reconstructed = templateDef ? reconstructTemplate(templateDef) : null;
              let previewText = conv.lastMessage?.text || '';
              if (reconstructed?.bodyText) {
                previewText = reconstructed.bodyText;
              } else if (conv.lastMessage?.template) {
                previewText = `Template: ${conv.lastMessage.template}`;
              }

              return (
                <div
                  key={conv.recipient}
                  onClick={() => {
                    setSelectedRecipient(conv.recipient);
                    setSelectedMessageId(null);
                  }}
                  className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-all border-l-4 ${
                    isSelected
                      ? 'bg-[#2a3942] border-l-emerald-500'
                      : 'border-l-transparent hover:bg-[#202c33]/60'
                  }`}
                >
                  {/* Contact Avatar */}
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center flex-none text-white font-bold text-xs shadow-md border border-white/10`}>
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-xs font-semibold text-slate-200 truncate pr-1">
                        {displayName}
                      </h2>
                      <span className={`text-[10px] flex-none tabular-nums ${isFailed ? 'text-rose-400 font-semibold' : 'text-slate-400'}`}>
                        {formatRelative(conv.lastActivity)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 flex-1">
                        {conv.lastMessage?.direction === 'OUTGOING' && (
                          <StatusTickIcon status={conv.lastMessage.status} size={13} />
                        )}
                        <span className="truncate">{previewText}</span>
                      </p>

                      {conv.unread && (
                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center flex-none">
                          1
                        </span>
                      )}

                      {isFailed && !conv.unread && (
                        <AlertCircle size={14} className="text-rose-400 flex-none" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* COLUMN 2 — CONVERSATION VIEW (FLEXIBLE)                           */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-[#0b141a]">

        {/* WhatsApp Background Pattern Tint */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 0h40v40H0V0zm40 40h40v40H40V40zM0 40h40v40H0V40zm40-40h40v40H40V0z'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {selectedRecipient ? (
          <>
            {/* Sticky Header */}
            <div className="flex-none px-4 py-2.5 bg-[#202c33] border-b border-slate-800/80 flex items-center justify-between z-10 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(selectedRecipient)} flex items-center justify-center text-white font-bold text-xs flex-none shadow`}>
                  {getInitials(activeConv?.customerName || selectedRecipient)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-100 truncate">
                    {activeConv?.customerName !== activeConv?.recipient ? activeConv?.customerName : selectedRecipient}
                  </h2>
                  <p className="text-[11px] text-slate-400 flex items-center gap-2 truncate">
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                      WhatsApp Sandbox
                    </span>
                    <span>•</span>
                    <span>{selectedRecipient}</span>
                    <span>•</span>
                    <span>{chatMessages.length} messages</span>
                  </p>
                </div>
              </div>

              {/* Header Toolbar */}
              <div className="flex items-center gap-1 text-slate-300">
                {/* Search inside conversation */}
                <button
                  onClick={() => setIsSearchInChatOpen(!isSearchInChatOpen)}
                  className={`p-2 rounded-full hover:bg-slate-700/50 transition-colors ${isSearchInChatOpen ? 'text-emerald-400 bg-slate-700/40' : ''}`}
                  title="Search in conversation"
                >
                  <Search size={17} />
                </button>

                {/* Media Gallery */}
                <button
                  onClick={() => setIsGalleryOpen(true)}
                  className="p-2 rounded-full hover:bg-slate-700/50 transition-colors"
                  title="Media Gallery"
                >
                  <ImageIcon size={17} />
                </button>

                {/* Scroll to bottom */}
                <button
                  onClick={() => scrollToBottom('smooth')}
                  className="p-2 rounded-full hover:bg-slate-700/50 transition-colors"
                  title="Jump to latest"
                >
                  <ChevronDown size={17} />
                </button>

                {/* Toggle Inspector Sidebar */}
                <button
                  onClick={() => setIsInspectorOpen(!isInspectorOpen)}
                  className={`p-2 rounded-full hover:bg-slate-700/50 transition-colors ${isInspectorOpen ? 'text-emerald-400' : ''}`}
                  title={isInspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
                >
                  {isInspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
                </button>
              </div>
            </div>

            {/* In-Chat Search Bar Overlay */}
            {isSearchInChatOpen && (
              <div className="flex-none bg-[#111b21] border-b border-slate-800/80 px-4 py-2 flex items-center justify-between gap-3 z-10">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search in this chat..."
                    value={chatSearchQuery}
                    onChange={e => {
                      setChatSearchQuery(e.target.value);
                      setChatSearchMatchIndex(0);
                    }}
                    autoFocus
                    className="w-full bg-[#202c33] border border-slate-700/60 rounded-lg pl-9 pr-8 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
                  />
                  {chatSearchQuery && (
                    <button
                      onClick={() => setChatSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {searchMatches.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-slate-400 flex-none">
                    <span>{chatSearchMatchIndex + 1} of {searchMatches.length}</span>
                    <button
                      onClick={() => setChatSearchMatchIndex(prev => (prev > 0 ? prev - 1 : searchMatches.length - 1))}
                      className="p-1 rounded hover:bg-slate-800"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => setChatSearchMatchIndex(prev => (prev < searchMatches.length - 1 ? prev + 1 : 0))}
                      className="p-1 rounded hover:bg-slate-800"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setIsSearchInChatOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Conversation Feed */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4 relative z-0 scrollbar-thin scrollbar-thumb-slate-700"
            >
              {isLoadingChat ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : groupedMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                  <MessageSquare size={36} className="opacity-20" />
                  <p>No messages in this conversation yet</p>
                </div>
              ) : (
                groupedMessages.map(([dateKey, msgs]) => (
                  <div key={dateKey} className="space-y-2">

                    {/* Date Separator Badge */}
                    <div className="flex justify-center my-3 sticky top-2 z-10">
                      <span className="bg-[#111b21]/90 backdrop-blur-md text-slate-300 text-[11px] px-3.5 py-1 rounded-lg font-medium shadow border border-slate-800/80">
                        {formatSmartDate(dateKey)}
                      </span>
                    </div>

                    {/* Messages in Group */}
                    {msgs.map((msg, idx) => {
                      const isOut = msg.direction === 'OUTGOING';
                      const isSelectedMsg = msg.id === selectedMessage?.id;
                      const prevMsg = idx > 0 ? msgs[idx - 1] : null;
                      const isConsecutive = prevMsg && prevMsg.direction === msg.direction;

                      /* Template reconstruction */
                      const templateDef = msg.template ? templatesMap.get(msg.template) : undefined;
                      const reconstructed = templateDef ? reconstructTemplate(templateDef, msg.variables) : null;

                      /* Message Types check */
                      const messageType = msg.messageType?.toLowerCase() || (msg.metadata?.mediaUrl ? 'image' : 'text');
                      const mediaUrl = msg.metadata?.mediaUrl || msg.metadata?.mediaBase64;
                      const documentName = msg.metadata?.documentName || 'Document.pdf';

                      return (
                        <div
                          key={msg.id}
                          id={`msg-${msg.id}`}
                          onClick={() => setSelectedMessageId(msg.id)}
                          className={`flex ${isOut ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-1' : 'mt-3'}`}
                        >
                          <div
                            className={`group relative max-w-[75%] sm:max-w-[65%] rounded-xl px-3.5 py-2 cursor-pointer transition-all shadow-sm ${
                              isOut
                                ? `bg-[#005c4b] text-emerald-50 ${!isConsecutive ? 'rounded-tr-none' : ''}`
                                : `bg-[#202c33] text-slate-100 ${!isConsecutive ? 'rounded-tl-none' : ''}`
                            } ${isSelectedMsg ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0b141a]' : ''}`}
                          >

                            {/* Tail SVG */}
                            {!isConsecutive && (
                              <div
                                className={`absolute top-0 w-2.5 h-3 ${
                                  isOut
                                    ? '-right-2 text-[#005c4b]'
                                    : '-left-2 text-[#202c33]'
                                }`}
                              >
                                <svg viewBox="0 0 8 13" height="13" width="8" className="fill-current">
                                  <path d={isOut ? "M0 0v13l8-13H0z" : "M8 0v13L0 0h8z"} />
                                </svg>
                              </div>
                            )}

                            {/* Header format or Template Badge */}
                            {isOut && msg.template && (
                              <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-emerald-400/20 text-[10px] font-semibold text-emerald-200/90">
                                <span>📋 Template: {msg.template}</span>
                                <span className="font-mono text-[9px] opacity-75">{msg.messageId ? msg.messageId.substring(0, 8) : ''}</span>
                              </div>
                            )}

                            {/* ── RICH MESSAGE RENDERING TYPES ── */}

                            {/* 1. Image Preview */}
                            {(messageType === 'image' || mediaUrl) && (
                              <div className="mb-2 rounded-lg overflow-hidden border border-black/20 relative group/img">
                                <img
                                  src={mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'}
                                  alt="Attachment"
                                  className="w-full max-h-64 object-cover cursor-pointer hover:scale-105 transition-transform"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxImage(mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80');
                                  }}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxImage(mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80');
                                  }}
                                  className="absolute right-2 bottom-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md backdrop-blur-sm opacity-0 group-hover/img:opacity-100 transition-opacity"
                                >
                                  <Maximize2 size={13} />
                                </button>
                              </div>
                            )}

                            {/* 2. Document Preview Card */}
                            {messageType === 'document' && (
                              <div className="mb-2 p-2.5 rounded-lg bg-black/20 border border-white/10 flex items-center gap-3">
                                <div className="p-2.5 bg-rose-500/20 text-rose-300 rounded-lg flex-none">
                                  <File size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-100 truncate">{documentName}</p>
                                  <p className="text-[10px] text-slate-300 opacity-75">PDF Document • 1.2 MB</p>
                                </div>
                                <button className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors flex-none">
                                  <Download size={14} />
                                </button>
                              </div>
                            )}

                            {/* 3. Audio Message Card */}
                            {messageType === 'audio' && (
                              <div className="mb-2 p-2 rounded-lg bg-black/20 border border-white/10 flex items-center gap-3 min-w-[200px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPlayingAudioId(playingAudioId === msg.id ? null : msg.id);
                                  }}
                                  className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-none shadow"
                                >
                                  {playingAudioId === msg.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                                </button>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-1 h-4">
                                    {[30, 60, 40, 80, 50, 90, 70, 40, 60, 30, 70, 90, 50, 40].map((h, i) => (
                                      <div
                                        key={i}
                                        className={`w-1 rounded-full transition-all ${playingAudioId === msg.id ? 'bg-emerald-300 animate-pulse' : 'bg-white/40'}`}
                                        style={{ height: `${h}%` }}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-[10px] opacity-75 block">Voice Message • 0:24</span>
                                </div>
                              </div>
                            )}

                            {/* 4. Location Card */}
                            {messageType === 'location' && (
                              <div className="mb-2 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                                <div className="h-24 bg-gradient-to-br from-teal-900 to-slate-900 flex items-center justify-center relative">
                                  <MapPin size={28} className="text-emerald-400 animate-bounce" />
                                </div>
                                <div className="p-2 text-xs">
                                  <p className="font-semibold text-slate-100">Customer Shared Location</p>
                                  <p className="text-[10px] opacity-75">Lat: 28.6139, Lng: 77.2090</p>
                                  <a
                                    href="https://maps.google.com/?q=28.6139,77.2090"
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-300 hover:underline"
                                  >
                                    <ExternalLink size={10} /> Open in Google Maps
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* 5. Contact Card */}
                            {messageType === 'contacts' && (
                              <div className="mb-2 p-2.5 rounded-lg bg-black/20 border border-white/10 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs flex-none">
                                  <User size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-100 truncate">Contact Card</p>
                                  <p className="text-[10px] opacity-75 truncate">+91 98765 43210</p>
                                </div>
                              </div>
                            )}

                            {/* Reconstructed Template / Text Content */}
                            {reconstructed ? (
                              <div className="space-y-1.5 text-xs leading-relaxed">
                                {reconstructed.headerText && (
                                  <h4 className="font-bold text-sm text-white">{reconstructed.headerText}</h4>
                                )}
                                <div className="whitespace-pre-wrap">{reconstructed.bodyText}</div>
                                {reconstructed.footerText && (
                                  <p className="text-[10px] opacity-70 border-t border-white/10 pt-1 mt-1">
                                    {reconstructed.footerText}
                                  </p>
                                )}

                                {/* Interactive Template Buttons */}
                                {reconstructed.buttons.length > 0 && (
                                  <div className="pt-2 mt-2 border-t border-white/10 space-y-1">
                                    {reconstructed.buttons.map((btn: any, bIdx: number) => (
                                      <button
                                        key={bIdx}
                                        onClick={e => e.stopPropagation()}
                                        className="w-full py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                                      >
                                        {btn.type === 'URL' && <ExternalLink size={12} />}
                                        {btn.type === 'PHONE_NUMBER' && <Phone size={12} />}
                                        <span>{btn.text}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Standard Text / Variables Fallback */
                              <div className="text-xs leading-relaxed whitespace-pre-wrap">
                                {msg.text ? (
                                  msg.text
                                ) : isOut ? (
                                  msg.variables && Array.isArray(msg.variables) && msg.variables.length > 0 ? (
                                    <span>{msg.variables.join(' • ')}</span>
                                  ) : (
                                    <span className="italic opacity-80">Notification delivered via template</span>
                                  )
                                ) : (
                                  <span className="italic opacity-70">[{msg.messageType || 'incoming message'}]</span>
                                )}
                              </div>
                            )}

                            {/* Bubble Footer (Time & Ticks) */}
                            <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isOut ? 'text-emerald-200/70' : 'text-slate-400'}`}>
                              <span>{formatTime(msg.timestamp)}</span>
                              {isOut && <StatusTickIcon status={msg.status} size={14} />}
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Sticky Message Composer Placeholder */}
            <div className="flex-none px-4 py-3 bg-[#202c33] border-t border-slate-800/80 z-10">
              <div className="flex items-center gap-2 bg-[#2a3942] border border-slate-700/50 rounded-xl px-3 py-2">
                <button title="Attach Media" className="text-slate-400 hover:text-slate-200 transition-colors">
                  <Paperclip size={18} />
                </button>

                <input
                  type="text"
                  placeholder="Type a message or select template... (WhatsApp Sandbox / Read-only)"
                  disabled
                  className="flex-1 bg-transparent text-xs text-slate-300 placeholder:text-slate-500 outline-none cursor-not-allowed"
                />

                <button title="Emoji" className="text-slate-400 hover:text-slate-200 transition-colors">
                  <Smile size={18} />
                </button>

                <button disabled className="p-1.5 rounded-lg bg-emerald-600/40 text-emerald-300 cursor-not-allowed">
                  <Send size={15} />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 text-center mt-1.5">
                WhatsApp Gateway v0.0.1 • Read-Only Message Inspection & Realtime Webhook Tracking
              </p>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-3">
            <div className="w-16 h-16 rounded-full bg-[#202c33] flex items-center justify-center text-slate-400">
              <MessageSquare size={32} />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-semibold text-slate-200">Kamna Conversation Center</h3>
              <p className="text-slate-500 text-[11px] mt-1">Select a recipient from the left column to inspect live conversation history</p>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* COLUMN 3 — INSPECTOR SIDEBAR (360px, COLLAPSIBLE)                 */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isInspectorOpen && (
        <div className="w-[360px] flex-none flex flex-col border-l border-slate-800/80 bg-[#111b21] z-20 transition-all h-full overflow-hidden">

          {/* Inspector Header */}
          <div className="p-3 bg-[#202c33] border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Message Inspector</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={generateDebugReport}
                disabled={isGeneratingReport}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50 border border-emerald-500/40 text-[11px] font-semibold transition-all"
                title="Copy AI-friendly Debug Report"
              >
                <FileText size={12} />
                <span>{isGeneratingReport ? 'Copying...' : 'Copy Report'}</span>
              </button>
              <button
                onClick={() => setIsInspectorOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {selectedMessage ? (
            <>
              {/* Tab Selector */}
              <div className="flex border-b border-slate-800/80 bg-[#111b21] px-2 pt-2 gap-1 overflow-x-auto scrollbar-none">
                {INSPECTOR_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setInspectorTab(tab.key)}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-t-lg transition-all whitespace-nowrap ${
                      inspectorTab === tab.key
                        ? 'bg-[#202c33] text-emerald-400 border-t-2 border-emerald-500'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#202c33]/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs scrollbar-thin scrollbar-thumb-slate-700">

                {/* 1. OVERVIEW TAB */}
                {inspectorTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Status Card */}
                    <div className="p-3.5 rounded-xl bg-[#202c33] border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">Status</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedMessage.status === 'DELIVERED' || selectedMessage.status === 'READ'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : selectedMessage.status === 'FAILED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {selectedMessage.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Direction</span>
                        <span className="font-semibold text-slate-200">{selectedMessage.direction}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Provider Latency</span>
                        <span className="font-mono text-emerald-400">{selectedMessage.providerLatency ? `${selectedMessage.providerLatency}ms` : 'N/A'}</span>
                      </div>
                    </div>

                    {/* Details Table */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Identifiers</h4>
                      <div className="bg-[#202c33] rounded-xl border border-slate-800 p-3 space-y-2 font-mono text-[11px]">
                        <div>
                          <span className="text-slate-500 block text-[10px] font-sans">Message ID</span>
                          <span className="text-slate-200 select-all break-all">{selectedMessage.messageId || selectedMessage.id}</span>
                        </div>
                        {selectedMessage.eventId && (
                          <div>
                            <span className="text-slate-500 block text-[10px] font-sans">Event ID</span>
                            <span className="text-slate-300 select-all break-all">{selectedMessage.eventId}</span>
                          </div>
                        )}
                        {selectedMessage.providerMessageId && (
                          <div>
                            <span className="text-slate-500 block text-[10px] font-sans">Meta WAMID</span>
                            <span className="text-emerald-400 select-all break-all">{selectedMessage.providerMessageId}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delivery Parameters */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Parameters</h4>
                      <div className="bg-[#202c33] rounded-xl border border-slate-800 p-3 space-y-2 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Recipient</span>
                          <span className="text-slate-200 font-semibold">{selectedMessage.recipient}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Template</span>
                          <span className="text-slate-200 font-medium">{selectedMessage.template || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Requested By</span>
                          <span className="text-slate-200">{selectedMessage.requestedBy || 'system'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Source</span>
                          <span className="text-slate-200">{selectedMessage.source || 'gateway'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. TIMELINE TAB */}
                {inspectorTab === 'timeline' && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Delivery Milestones</h4>
                    {selectedMessage.timeline && selectedMessage.timeline.length > 0 ? (
                      <div className="relative pl-4 border-l-2 border-slate-800 space-y-4">
                        {selectedMessage.timeline.map((item: any, tIdx: number) => (
                          <div key={tIdx} className="relative">
                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#111b21]" />
                            <div className="bg-[#202c33] p-2.5 rounded-lg border border-slate-800">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-bold text-emerald-400">{item.status}</span>
                                <span className="text-slate-500 tabular-nums">{new Date(item.createdAt).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-[11px] text-slate-300">{item.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-[#202c33] p-4 rounded-xl border border-slate-800 text-center text-slate-500">
                        <Clock size={24} className="mx-auto mb-2 opacity-40" />
                        <p>No explicit timeline events logged for this message</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. PAYLOAD TAB */}
                {inspectorTab === 'payload' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Final Provider Payload</h4>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedMessage.rawPayload || selectedMessage, null, 2));
                          toast.success('Payload copied');
                        }}
                        className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Copy size={11} /> Copy JSON
                      </button>
                    </div>
                    <pre className="bg-[#0b141a] p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-96">
                      {JSON.stringify(selectedMessage.rawPayload || selectedMessage.providerResponse || selectedMessage, null, 2)}
                    </pre>
                  </div>
                )}

                {/* 4. WEBHOOKS TAB */}
                {inspectorTab === 'webhooks' && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Matched Webhook Callbacks</h4>
                    <div className="bg-[#202c33] p-3 rounded-xl border border-slate-800 text-center text-slate-400 text-xs space-y-2">
                      <Zap size={24} className="mx-auto text-emerald-400" />
                      <p className="font-semibold text-slate-200">Webhook Inspector Connected</p>
                      <p className="text-[11px] text-slate-400">
                        Matches provider WAMID <code className="text-emerald-300">{selectedMessage.providerMessageId || 'N/A'}</code>
                      </p>
                    </div>
                  </div>
                )}

                {/* 5. METADATA TAB */}
                {inspectorTab === 'metadata' && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Variables & Context</h4>
                    {selectedMessage.variables ? (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500">Variables Array</span>
                        <pre className="bg-[#0b141a] p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                          {JSON.stringify(selectedMessage.variables, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-xs italic">No template variables recorded</p>
                    )}

                    {selectedMessage.metadata && (
                      <div className="space-y-1 mt-3">
                        <span className="text-[10px] text-slate-500">Metadata JSON</span>
                        <pre className="bg-[#0b141a] p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                          {JSON.stringify(selectedMessage.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-500 text-xs">
              Select a message bubble in the conversation to inspect details
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MEDIA GALLERY MODAL                                               */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isGalleryOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111b21] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 bg-[#202c33] border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <ImageIcon size={16} className="text-emerald-400" />
                Media, Links & Docs Gallery
              </h3>
              <button onClick={() => setIsGalleryOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Gallery Tabs */}
            <div className="flex border-b border-slate-800 bg-[#111b21] px-4 pt-2 gap-2">
              <button
                onClick={() => setGalleryTab('media')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                  galleryTab === 'media' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Media ({galleryItems.media.length})
              </button>
              <button
                onClick={() => setGalleryTab('documents')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                  galleryTab === 'documents' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Documents ({galleryItems.docs.length})
              </button>
              <button
                onClick={() => setGalleryTab('links')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                  galleryTab === 'links' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Links ({galleryItems.links.length})
              </button>
            </div>

            {/* Gallery Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {galleryTab === 'media' && (
                galleryItems.media.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">No media files shared yet</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {galleryItems.media.map(m => (
                      <div
                        key={m.id}
                        onClick={() => setLightboxImage(m.metadata?.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80')}
                        className="aspect-square rounded-xl bg-slate-900 border border-slate-800 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={m.metadata?.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'}
                          alt="Media"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )
              )}

              {galleryTab === 'documents' && (
                galleryItems.docs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">No documents shared yet</div>
                ) : (
                  <div className="space-y-2">
                    {galleryItems.docs.map(d => (
                      <div key={d.id} className="p-3 bg-[#202c33] rounded-xl border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <File size={20} className="text-rose-400" />
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{d.metadata?.documentName || 'Document.pdf'}</p>
                            <p className="text-[10px] text-slate-400">{formatTime(d.timestamp)}</p>
                          </div>
                        </div>
                        <button className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200">
                          <Download size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}

              {galleryTab === 'links' && (
                galleryItems.links.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">No links found in messages</div>
                ) : (
                  <div className="space-y-2">
                    {galleryItems.links.map((l, i) => (
                      <div key={i} className="p-3 bg-[#202c33] rounded-xl border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <LinkIcon size={14} className="text-emerald-400 flex-none" />
                          <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 hover:underline truncate">
                            {l.url}
                          </a>
                        </div>
                        <span className="text-[10px] text-slate-400 flex-none">{formatTime(l.msg.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* LIGHTBOX MODAL                                                    */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute right-3 top-3 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors z-10"
            >
              <X size={20} />
            </button>
            <img src={lightboxImage} alt="Enlarged media" className="max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}

    </div>
  );
}

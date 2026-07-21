import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../utils/api';
import {
  Search, MessageSquare, Clock, Check, CheckCheck, AlertCircle,
  CornerDownLeft, Zap, FileText, Terminal, Copy, X, Send,
  Paperclip, Smile, ChevronDown, ExternalLink, Hash,
  ArrowRight, Star, Inbox, AlertTriangle, CalendarDays
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

type ConvFilter = 'all' | 'unread' | 'failed' | 'today' | 'starred';
type InspectorTab = 'overview' | 'timeline' | 'payload' | 'webhooks' | 'metadata';

/* ─────────── Helpers ─────────── */
const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const AVATAR_COLORS = [
  'from-violet-600 to-indigo-600',
  'from-emerald-600 to-teal-600',
  'from-rose-600 to-pink-600',
  'from-amber-600 to-orange-600',
  'from-cyan-600 to-blue-600',
  'from-fuchsia-600 to-purple-600',
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
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const formatTime = (ts: string) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatRelative = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/* ─────────── Component ─────────── */
export default function Communications() {
  const [searchQuery, setSearchQuery] = useState('');
  const [convFilter, setConvFilter] = useState<ConvFilter>('all');
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [expandedBubbles, setExpandedBubbles] = useState<Set<string>>(new Set());
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  /* ── Data fetching ── */
  const { data: conversationsData, isLoading: isLoadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const r = await apiFetch('/api/v1/messages/conversations');
      if (!r.ok) throw new Error('Failed');
      return ((await r.json()).conversations || []) as ConversationSummary[];
    },
    refetchInterval: 4000,
  });
  const conversations = conversationsData || [];

  useEffect(() => {
    if (conversations.length > 0 && !selectedRecipient) setSelectedRecipient(conversations[0].recipient);
  }, [conversations, selectedRecipient]);

  const { data: chatData, isLoading: isLoadingChat } = useQuery({
    queryKey: ['conversationMessages', selectedRecipient],
    queryFn: async () => {
      if (!selectedRecipient) return [];
      const r = await apiFetch(`/api/v1/messages/conversations/${selectedRecipient}`);
      if (!r.ok) throw new Error('Failed');
      return ((await r.json()).messages || []) as ChatMessage[];
    },
    enabled: !!selectedRecipient,
    refetchInterval: 3000,
  });
  const chatMessages = chatData || [];

  const selectedMessage = chatMessages.find(m => m.id === selectedMessageId);
  const activeConv = conversations.find(c => c.recipient === selectedRecipient);

  /* ── Auto-scroll ── */
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }, []);

  useEffect(() => {
    if (isAtBottom) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAtBottom]);

  /* ── Filtering ── */
  const filteredConversations = conversations.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      c.recipient.includes(q) ||
      c.customerName.toLowerCase().includes(q) ||
      c.lastMessage.text.toLowerCase().includes(q) ||
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

  /* ── Grouping ── */
  const groupMessagesByDate = (msgs: ChatMessage[]) => {
    const groups: [string, ChatMessage[]][] = [];
    let currentDate = '';
    msgs.forEach(msg => {
      const d = new Date(msg.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (key !== currentDate) {
        currentDate = key;
        groups.push([msg.timestamp, []]);
      }
      groups[groups.length - 1][1].push(msg);
    });
    return groups;
  };

  /* ── Conversation stats ── */
  const getConvStats = () => {
    const outgoing = chatMessages.filter(m => m.direction === 'OUTGOING');
    return {
      total: chatMessages.length,
      outgoing: outgoing.length,
      incoming: chatMessages.filter(m => m.direction === 'INCOMING').length,
      delivered: outgoing.filter(m => ['DELIVERED', 'READ', 'REPLIED'].includes(m.status)).length,
      read: outgoing.filter(m => ['READ', 'REPLIED'].includes(m.status)).length,
      failed: outgoing.filter(m => m.status === 'FAILED').length,
    };
  };

  /* ── Handlers ── */
  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
    toast.success('Copied to clipboard');
  };

  const toggleExpand = (id: string) => {
    setExpandedBubbles(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const generateDebugReport = async () => {
    if (!selectedMessage || selectedMessage.direction !== 'OUTGOING') return;
    setIsGeneratingReport(true);
    try {
      const r = await apiFetch(`/api/v1/webhook-inspector?search=${selectedMessage.messageId}&limit=100`);
      let webhooks: any[] = [];
      if (r.ok) { const j = await r.json(); webhooks = j.data || []; }

      const finalPayload = selectedMessage.timeline?.find((t: any) => t.description === 'Template Sent')?.metadata?.payload || {};

      let report = `# Kamna Gateway Debug Report\n\n`;
      report += `## Communication\n`;
      report += `| Field | Value |\n|---|---|\n`;
      report += `| Communication ID | \`${selectedMessage.messageId}\` |\n`;
      report += `| Event ID | \`${selectedMessage.eventId}\` |\n`;
      report += `| Recipient | ${selectedMessage.recipient} |\n`;
      report += `| Direction | ${selectedMessage.direction} |\n`;
      report += `| Template | ${selectedMessage.template} |\n`;
      report += `| Channel | ${selectedMessage.channel} |\n`;
      report += `| Status | **${selectedMessage.status}** |\n`;
      report += `| Created | ${new Date(selectedMessage.createdAt || selectedMessage.timestamp).toLocaleString()} |\n\n`;

      if (selectedMessage.variables) {
        report += `## Variables\n\`\`\`json\n${JSON.stringify(selectedMessage.variables, null, 2)}\n\`\`\`\n\n`;
      }

      report += `## Provider Information\n`;
      report += `| Field | Value |\n|---|---|\n`;
      report += `| Provider Message ID | \`${selectedMessage.providerMessageId || 'N/A'}\` |\n`;
      report += `| Provider Status | ${selectedMessage.providerStatus || 'N/A'} |\n`;
      report += `| HTTP Status | ${selectedMessage.providerHttpStatus || 'N/A'} |\n`;
      report += `| Latency | ${selectedMessage.providerLatency ? selectedMessage.providerLatency + 'ms' : 'N/A'} |\n`;
      report += `| Accepted At | ${selectedMessage.acceptedAt ? new Date(selectedMessage.acceptedAt).toLocaleString() : 'N/A'} |\n\n`;

      report += `## Delivery Timeline\n`;
      if (selectedMessage.timeline && selectedMessage.timeline.length > 0) {
        report += `| Time | Status | Description |\n|---|---|---|\n`;
        selectedMessage.timeline.forEach((t: any) => {
          report += `| ${new Date(t.createdAt).toLocaleTimeString()} | ${t.status} | ${t.description} |\n`;
        });
        report += `\n`;
      } else { report += `No timeline recorded.\n\n`; }

      report += `## Final Payload\n\`\`\`json\n${JSON.stringify(finalPayload, null, 2)}\n\`\`\`\n\n`;
      report += `## Provider Response\n\`\`\`json\n${JSON.stringify(selectedMessage.providerResponse || {}, null, 2)}\n\`\`\`\n\n`;

      if (selectedMessage.status === 'FAILED') {
        report += `## ⚠️ Failure Details\n\`\`\`json\n${JSON.stringify(selectedMessage.providerResponse || {}, null, 2)}\n\`\`\`\n\n`;
      }

      if (webhooks.length > 0) {
        report += `## Webhook History\n`;
        report += `| Time | Type | Provider ID | Status | Result |\n|---|---|---|---|---|\n`;
        webhooks.forEach((w: any) => {
          report += `| ${w.receivedAt ? new Date(w.receivedAt).toLocaleString() : 'N/A'} | ${w.eventType || '?'} | \`${w.matchedProviderMessageId || 'N/A'}\` | ${w.processingStatus} | ${w.errorMessage || 'OK'} |\n`;
        });
        report += `\n`;
      }

      if (selectedMessage.metadata) {
        report += `## Metadata\n\`\`\`json\n${JSON.stringify(selectedMessage.metadata, null, 2)}\n\`\`\`\n\n`;
      }

      report += `---\n*Gateway v0.0.1 • SQLite • Provider: ${selectedMessage.provider || 'Meta WhatsApp'} • Generated: ${new Date().toLocaleString()}*\n`;

      await navigator.clipboard.writeText(report);
      toast.success('Debug report copied to clipboard');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate report');
    } finally { setIsGeneratingReport(false); }
  };

  /* ── Status rendering ── */
  const StatusIcon = ({ status, size = 14 }: { status: string; size?: number }) => {
    switch (status) {
      case 'QUEUED': case 'VALIDATED': case 'PROCESSING':
        return <Clock size={size} className="text-slate-500" />;
      case 'SENDING': case 'META_ACCEPTED':
        return <Check size={size} className="text-slate-400" />;
      case 'SENT':
        return <CheckCheck size={size} className="text-slate-400" />;
      case 'DELIVERED':
        return <CheckCheck size={size} className="text-emerald-400" />;
      case 'READ':
        return <CheckCheck size={size} className="text-blue-400" />;
      case 'REPLIED':
        return <CornerDownLeft size={size} className="text-pink-400" />;
      case 'FAILED':
        return <AlertCircle size={size} className="text-red-400" />;
      default:
        return <Clock size={size} className="text-slate-500" />;
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      QUEUED: { text: 'Queued', cls: 'text-slate-400' },
      VALIDATED: { text: 'Validated', cls: 'text-slate-400' },
      PROCESSING: { text: 'Processing', cls: 'text-amber-400' },
      SENDING: { text: 'Sending', cls: 'text-amber-400' },
      META_ACCEPTED: { text: 'Accepted', cls: 'text-blue-400' },
      SENT: { text: 'Sent', cls: 'text-blue-400' },
      DELIVERED: { text: 'Delivered', cls: 'text-emerald-400' },
      READ: { text: 'Read', cls: 'text-blue-400' },
      REPLIED: { text: 'Replied', cls: 'text-pink-400' },
      FAILED: { text: 'Failed', cls: 'text-red-400' },
      RECEIVED: { text: 'Received', cls: 'text-emerald-400' },
    };
    return map[s] || { text: s, cls: 'text-slate-400' };
  };

  /* ── Filter chips ── */
  const FILTERS: { key: ConvFilter; label: string; icon: any }[] = [
    { key: 'all', label: 'All', icon: Inbox },
    { key: 'unread', label: 'Unread', icon: MessageSquare },
    { key: 'failed', label: 'Failed', icon: AlertTriangle },
    { key: 'today', label: 'Today', icon: CalendarDays },
    { key: 'starred', label: 'Starred', icon: Star },
  ];

  /* ── Inspector tabs ── */
  const TABS: { key: InspectorTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'payload', label: 'Payload' },
    { key: 'webhooks', label: 'Webhooks' },
    { key: 'metadata', label: 'Metadata' },
  ];

  const groupedMessages = groupMessagesByDate(chatMessages);
  const stats = getConvStats();

  return (
    <div className="h-full flex bg-slate-950 text-slate-200 overflow-hidden">

      {/* ══════════ COLUMN 1 — CONVERSATION LIST (22%) ══════════ */}
      <div className="w-[22%] min-w-[260px] max-w-[360px] flex-none flex flex-col border-r border-slate-800/80 bg-slate-950">

        {/* Header */}
        <div className="p-4 pb-3 flex-none">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold text-white tracking-tight">Messages</h1>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold tabular-nums">
              {conversations.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-[7px] text-xs focus:outline-none focus:border-indigo-500/60 text-slate-300 placeholder:text-slate-600 transition-colors"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {FILTERS.map(f => {
              const Icon = f.icon;
              const active = convFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setConvFilter(f.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                    active
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                      : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Icon size={11} />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-600 text-xs">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
              No conversations found
            </div>
          ) : (
            filteredConversations.map(conv => {
              const sel = conv.recipient === selectedRecipient;
              const displayName = conv.customerName !== conv.recipient ? conv.customerName : conv.recipient;
              const initials = getInitials(displayName);
              const avatarGrad = getAvatarColor(conv.recipient);
              const isFailed = conv.lastMessage.status === 'FAILED';

              return (
                <div
                  key={conv.recipient}
                  onClick={() => { setSelectedRecipient(conv.recipient); setSelectedMessageId(null); setInspectorTab('overview'); }}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-l-[3px] ${
                    sel
                      ? 'bg-slate-900/80 border-l-indigo-500'
                      : 'border-l-transparent hover:bg-slate-900/40'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center flex-none shadow-lg`}>
                    <span className="text-white text-xs font-bold">{initials}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-[13px] text-slate-200 truncate">{displayName}</span>
                      <span className={`text-[10px] flex-none ml-2 tabular-nums ${isFailed ? 'text-red-400' : 'text-slate-500'}`}>
                        {formatRelative(conv.lastActivity)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-[11px] text-slate-500 truncate flex-1 flex items-center gap-1">
                        {conv.lastMessage.direction === 'OUTGOING' && (
                          <StatusIcon status={conv.lastMessage.status} size={12} />
                        )}
                        <span className="truncate">
                          {conv.lastMessage.direction === 'OUTGOING'
                            ? conv.lastMessage.text.startsWith('Template:')
                              ? conv.lastMessage.text.replace('Template: ', '📋 ')
                              : conv.lastMessage.text
                            : conv.lastMessage.text}
                        </span>
                      </p>
                      {conv.unread && (
                        <span className="w-[18px] h-[18px] rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white flex-none">
                          •
                        </span>
                      )}
                      {isFailed && !conv.unread && (
                        <AlertCircle size={14} className="text-red-400 flex-none" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ══════════ COLUMN 2 — CHAT PANEL (50%) ══════════ */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* Subtle pattern background */}
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        {selectedRecipient ? (
          <>
            {/* Chat Header */}
            <div className="flex-none px-5 py-3 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(selectedRecipient)} flex items-center justify-center shadow`}>
                  <span className="text-white text-xs font-bold">
                    {getInitials(activeConv?.customerName || selectedRecipient)}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-white text-sm leading-tight">
                    {activeConv?.customerName !== activeConv?.recipient
                      ? activeConv?.customerName
                      : selectedRecipient}
                  </h2>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span className="text-emerald-500">●</span>
                    {selectedRecipient}
                    <span className="text-slate-700 mx-0.5">•</span>
                    {chatMessages.length} messages
                    {activeConv?.lastActivity && (
                      <>
                        <span className="text-slate-700 mx-0.5">•</span>
                        Last active {formatRelative(activeConv.lastActivity)}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Feed */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-5 py-4 relative z-0"
            >
              {isLoadingChat ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : groupedMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs">
                  <MessageSquare size={32} className="mb-2 opacity-20" />
                  No messages yet
                </div>
              ) : (
                <div className="space-y-1">
                  {groupedMessages.map(([dateKey, msgs]) => (
                    <div key={dateKey}>
                      {/* Date chip */}
                      <div className="flex justify-center my-4">
                        <span className="bg-slate-900/90 backdrop-blur-sm text-slate-400 text-[11px] px-3.5 py-1 rounded-full font-medium shadow-sm border border-slate-800/60">
                          {formatSmartDate(dateKey)}
                        </span>
                      </div>

                      {/* Messages */}
                      {msgs.map(msg => {
                        const isOut = msg.direction === 'OUTGOING';
                        const isSel = msg.id === selectedMessageId;
                        const isExpanded = expandedBubbles.has(msg.id);
                        const isHovered = hoveredBubble === msg.id;
                        const sl = statusLabel(msg.status);

                        return (
                          <div
                            key={msg.id}
                            className={`flex mb-1.5 ${isOut ? 'justify-end' : 'justify-start'}`}
                            onMouseEnter={() => setHoveredBubble(msg.id)}
                            onMouseLeave={() => setHoveredBubble(null)}
                          >
                            <div className="relative max-w-[65%] group">
                              {/* Hover Actions */}
                              {isHovered && (
                                <div className={`absolute -top-8 ${isOut ? 'right-0' : 'left-0'} flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 shadow-xl z-20 animate-in fade-in duration-150`}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedMessageId(msg.id); setInspectorTab('overview'); }}
                                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Inspect"
                                  >
                                    <Terminal size={12} />
                                  </button>
                                  {isOut && msg.providerMessageId && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleCopy(msg.providerMessageId!, 'pid'); }}
                                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Copy Provider ID"
                                    >
                                      <Hash size={12} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleExpand(msg.id); }}
                                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Expand"
                                  >
                                    <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                  {isOut && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedMessageId(msg.id); generateDebugReport(); }}
                                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Debug Report"
                                    >
                                      <FileText size={12} />
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Bubble */}
                              <div
                                onClick={() => { setSelectedMessageId(msg.id); setInspectorTab('overview'); }}
                                className={`rounded-2xl px-3.5 py-2 cursor-pointer transition-all ${
                                  isOut
                                    ? `bg-indigo-600 text-white ${isOut ? 'rounded-br-md' : ''} hover:bg-indigo-500/90`
                                    : `bg-slate-900 text-slate-200 border border-slate-800/80 ${!isOut ? 'rounded-bl-md' : ''} hover:border-slate-700`
                                } ${isSel ? 'ring-1 ring-indigo-400/60 ring-offset-1 ring-offset-slate-950' : ''}`}
                              >
                                {/* Template badge (compact) */}
                                {isOut && msg.template && (
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium mb-1 ${isOut ? 'text-indigo-200/80' : 'text-slate-400'}`}>
                                    📋 {msg.template}
                                  </span>
                                )}

                                {/* Content */}
                                <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
                                  {isOut ? (
                                    msg.variables && Array.isArray(msg.variables) && msg.variables.length > 0
                                      ? msg.variables.join(' • ')
                                      : <span className="opacity-70 italic text-xs">Template message</span>
                                  ) : (
                                    msg.text || <span className="opacity-70 text-xs italic">[{msg.messageType || 'media'}]</span>
                                  )}
                                </div>

                                {/* Footer */}
                                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isOut ? 'text-indigo-200/60' : 'text-slate-500'}`}>
                                  <span>{formatTime(msg.timestamp)}</span>
                                  {isOut && <StatusIcon status={msg.status} size={13} />}
                                </div>

                                {/* Expandable Metadata */}
                                {isExpanded && (
                                  <div className={`mt-2 pt-2 border-t text-[11px] space-y-1.5 ${isOut ? 'border-indigo-400/20 text-indigo-100/80' : 'border-slate-800 text-slate-400'}`}>
                                    {msg.messageId && <div className="flex justify-between"><span className="opacity-60">ID</span> <span className="font-mono">{msg.messageId.substring(0, 12)}…</span></div>}
                                    {msg.providerMessageId && <div className="flex justify-between"><span className="opacity-60">Provider</span> <span className="font-mono truncate ml-2">{msg.providerMessageId.substring(0, 16)}…</span></div>}
                                    {msg.template && <div className="flex justify-between"><span className="opacity-60">Template</span> <span>{msg.template}</span></div>}
                                    {msg.providerLatency && <div className="flex justify-between"><span className="opacity-60">Latency</span> <span>{msg.providerLatency}ms</span></div>}
                                    <div className="flex justify-between"><span className="opacity-60">Status</span> <span className={sl.cls}>{sl.text}</span></div>
                                    {msg.variables && (
                                      <div className="mt-1">
                                        <span className="opacity-60 block mb-0.5">Variables</span>
                                        <pre className={`text-[10px] font-mono p-1.5 rounded ${isOut ? 'bg-indigo-900/40' : 'bg-slate-950'} overflow-auto max-h-24`}>
                                          {JSON.stringify(msg.variables, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Compose Bar (Future) */}
            <div className="flex-none px-5 py-3 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 opacity-50 cursor-not-allowed">
                <Paperclip size={16} className="text-slate-500" />
                <input
                  type="text"
                  placeholder="Type a message..."
                  disabled
                  className="flex-1 bg-transparent text-xs text-slate-400 outline-none cursor-not-allowed"
                />
                <Smile size={16} className="text-slate-500" />
                <button disabled className="p-1 rounded-full bg-indigo-600/30 text-indigo-400 cursor-not-allowed">
                  <Send size={14} />
                </button>
              </div>
              <p className="text-[10px] text-slate-600 text-center mt-1.5">Two-way messaging coming soon</p>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs gap-2">
            <MessageSquare size={40} className="opacity-15" />
            <span>Select a conversation</span>
          </div>
        )}
      </div>

      {/* ══════════ COLUMN 3 — INSPECTOR (28%) ══════════ */}
      <div className="w-[28%] min-w-[300px] max-w-[420px] flex-none flex flex-col border-l border-slate-800/80 bg-slate-950">

        {selectedMessage ? (
          <>
            {/* Inspector Header */}
            <div className="flex-none px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Terminal size={15} className="text-indigo-400 flex-none" />
                <span className="font-semibold text-sm text-white truncate">Inspector</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${statusLabel(selectedMessage.status).cls} bg-slate-900 border border-slate-800`}>
                  {statusLabel(selectedMessage.status).text}
                </span>
              </div>
              <button onClick={() => setSelectedMessageId(null)} className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex-none border-b border-slate-800/80 flex overflow-x-auto scrollbar-none">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setInspectorTab(tab.key)}
                  className={`px-3.5 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors relative ${
                    inspectorTab === tab.key
                      ? 'text-indigo-400'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                  {inspectorTab === tab.key && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-indigo-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Actions Row */}
            {selectedMessage.direction === 'OUTGOING' && (
              <div className="flex-none px-4 py-2 border-b border-slate-800/60 flex gap-2">
                <button
                  onClick={generateDebugReport}
                  disabled={isGeneratingReport}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
                >
                  <FileText size={12} /> {isGeneratingReport ? 'Copying…' : 'Debug Report'}
                </button>
                {selectedMessage.messageId && (
                  <a
                    href={`/dashboard/settings/diagnostics/webhooks?search=${selectedMessage.messageId}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1 bg-slate-900 hover:bg-slate-800 text-slate-300 py-1.5 px-3 rounded-lg text-[11px] font-medium border border-slate-800 transition-colors"
                  >
                    <Zap size={11} /> Webhooks
                  </a>
                )}
              </div>
            )}

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* ── Overview Tab ── */}
              {inspectorTab === 'overview' && (
                <>
                  <div className="space-y-3">
                    {[
                      { label: 'Direction', value: selectedMessage.direction, cls: selectedMessage.direction === 'OUTGOING' ? 'text-indigo-400' : 'text-emerald-400' },
                      { label: 'Status', value: statusLabel(selectedMessage.status).text, cls: statusLabel(selectedMessage.status).cls },
                      { label: 'Recipient', value: selectedMessage.recipient },
                      { label: 'Channel', value: selectedMessage.channel || 'whatsapp' },
                      { label: 'Template', value: selectedMessage.template || 'N/A' },
                      { label: 'Requested By', value: selectedMessage.requestedBy || 'N/A' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{row.label}</span>
                        <span className={`font-medium ${row.cls || 'text-slate-300'}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <hr className="border-slate-800/60" />
                  <div className="space-y-3">
                    {[
                      { label: 'Communication ID', value: selectedMessage.messageId, mono: true },
                      { label: 'Event ID', value: selectedMessage.eventId, mono: true },
                      { label: 'Created', value: selectedMessage.createdAt ? new Date(selectedMessage.createdAt).toLocaleString() : 'N/A' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-start justify-between text-xs gap-2">
                        <span className="text-slate-500 flex-none">{row.label}</span>
                        <span className={`text-slate-300 text-right truncate ${row.mono ? 'font-mono text-[10px]' : ''}`}>{row.value || 'N/A'}</span>
                      </div>
                    ))}
                  </div>

                  {/* Provider Info (compact) */}
                  {selectedMessage.direction === 'OUTGOING' && (
                    <>
                      <hr className="border-slate-800/60" />
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Provider</h4>
                      <div className="space-y-2.5">
                        {[
                          { label: 'Provider', value: selectedMessage.provider || 'Meta WhatsApp' },
                          { label: 'Provider ID', value: selectedMessage.providerMessageId, mono: true, copyable: true },
                          { label: 'HTTP Status', value: selectedMessage.providerHttpStatus, cls: selectedMessage.providerHttpStatus && selectedMessage.providerHttpStatus < 300 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold' },
                          { label: 'Latency', value: selectedMessage.providerLatency ? `${selectedMessage.providerLatency}ms` : 'N/A' },
                          { label: 'Accepted', value: selectedMessage.acceptedAt ? new Date(selectedMessage.acceptedAt).toLocaleString() : 'N/A' },
                        ].map((row, i) => (
                          <div key={i} className="flex items-center justify-between text-xs gap-2">
                            <span className="text-slate-500">{row.label}</span>
                            <div className="flex items-center gap-1">
                              <span className={`truncate max-w-[160px] ${row.mono ? 'font-mono text-[10px]' : ''} ${row.cls || 'text-slate-300'}`}>
                                {String(row.value || 'N/A')}
                              </span>
                              {row.copyable && row.value && (
                                <button onClick={() => handleCopy(String(row.value), `prov_${i}`)} className="text-slate-600 hover:text-white">
                                  {copiedSection === `prov_${i}` ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── Timeline Tab ── */}
              {inspectorTab === 'timeline' && (
                selectedMessage.timeline && selectedMessage.timeline.length > 0 ? (
                  <div className="relative pl-5 border-l-2 border-slate-800 space-y-5">
                    {selectedMessage.timeline.map((step: any, idx: number) => {
                      const isLast = idx === selectedMessage.timeline!.length - 1;
                      const isFail = step.status === 'FAILED';
                      return (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-[25px] top-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-slate-950 ${
                            isFail ? 'bg-red-500' : isLast ? 'bg-indigo-500 animate-pulse' : 'bg-indigo-500'
                          }`} />
                          <div>
                            <p className={`text-xs font-medium ${isFail ? 'text-red-400' : 'text-slate-200'}`}>
                              {step.description || step.status}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                              {new Date(step.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-8">No timeline data</p>
                )
              )}

              {/* ── Payload Tab ── */}
              {inspectorTab === 'payload' && (
                <div className="space-y-4">
                  {selectedMessage.variables && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Variables</span>
                        <button onClick={() => handleCopy(JSON.stringify(selectedMessage.variables, null, 2), 'p_vars')} className="text-slate-600 hover:text-white">
                          {copiedSection === 'p_vars' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-indigo-300 overflow-auto max-h-48">
                        {JSON.stringify(selectedMessage.variables, null, 2)}
                      </pre>
                    </div>
                  )}
                  {(() => {
                    const payload = selectedMessage.timeline?.find((t: any) => t.description === 'Template Sent')?.metadata?.payload;
                    return payload ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Final Payload</span>
                          <button onClick={() => handleCopy(JSON.stringify(payload, null, 2), 'p_pay')} className="text-slate-600 hover:text-white">
                            {copiedSection === 'p_pay' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                        <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-emerald-300 overflow-auto max-h-48">
                          {JSON.stringify(payload, null, 2)}
                        </pre>
                      </div>
                    ) : null;
                  })()}
                  {selectedMessage.providerResponse && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Provider Response</span>
                        <button onClick={() => handleCopy(JSON.stringify(selectedMessage.providerResponse, null, 2), 'p_resp')} className="text-slate-600 hover:text-white">
                          {copiedSection === 'p_resp' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-blue-300 overflow-auto max-h-48">
                        {JSON.stringify(selectedMessage.providerResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                  {!selectedMessage.variables && !selectedMessage.providerResponse && (
                    <p className="text-xs text-slate-500 text-center py-8">No payload data</p>
                  )}
                </div>
              )}

              {/* ── Webhooks Tab ── */}
              {inspectorTab === 'webhooks' && (
                <div className="text-center py-6">
                  {selectedMessage.messageId ? (
                    <a
                      href={`/dashboard/settings/diagnostics/webhooks?search=${selectedMessage.messageId}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <ExternalLink size={13} />
                      Open Webhook Inspector for this message
                      <ArrowRight size={13} />
                    </a>
                  ) : (
                    <p className="text-xs text-slate-500">No webhook data available</p>
                  )}
                </div>
              )}

              {/* ── Metadata Tab ── */}
              {inspectorTab === 'metadata' && (
                <div className="space-y-4">
                  {selectedMessage.metadata && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Metadata</span>
                        <button onClick={() => handleCopy(JSON.stringify(selectedMessage.metadata, null, 2), 'm_meta')} className="text-slate-600 hover:text-white">
                          {copiedSection === 'm_meta' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-emerald-300 overflow-auto max-h-60">
                        {JSON.stringify(selectedMessage.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedMessage.rawPayload && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Raw Payload</span>
                        <button onClick={() => handleCopy(JSON.stringify(selectedMessage.rawPayload, null, 2), 'm_raw')} className="text-slate-600 hover:text-white">
                          {copiedSection === 'm_raw' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-amber-300 overflow-auto max-h-60">
                        {JSON.stringify(selectedMessage.rawPayload, null, 2)}
                      </pre>
                    </div>
                  )}
                  {!selectedMessage.metadata && !selectedMessage.rawPayload && (
                    <p className="text-xs text-slate-500 text-center py-8">No metadata</p>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Conversation Summary (no message selected) ── */
          <div className="flex-1 flex flex-col overflow-y-auto">
            {selectedRecipient && activeConv ? (
              <div className="p-5 space-y-5">
                {/* Contact Card */}
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(selectedRecipient)} flex items-center justify-center shadow-lg`}>
                    <span className="text-white text-sm font-bold">{getInitials(activeConv.customerName || selectedRecipient)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">
                      {activeConv.customerName !== activeConv.recipient ? activeConv.customerName : selectedRecipient}
                    </h3>
                    <p className="text-[11px] text-slate-500">{selectedRecipient} • WhatsApp</p>
                  </div>
                </div>

                <hr className="border-slate-800/60" />

                {/* Stats Grid */}
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Conversation Stats</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Total', value: stats.total, cls: 'text-slate-200' },
                    { label: 'Sent', value: stats.outgoing, cls: 'text-indigo-400' },
                    { label: 'Received', value: stats.incoming, cls: 'text-emerald-400' },
                    { label: 'Delivered', value: stats.delivered, cls: 'text-emerald-400' },
                    { label: 'Read', value: stats.read, cls: 'text-blue-400' },
                    { label: 'Failed', value: stats.failed, cls: stats.failed > 0 ? 'text-red-400' : 'text-slate-400' },
                  ].map((s, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800/60 rounded-lg p-2.5 text-center">
                      <div className={`text-base font-bold tabular-nums ${s.cls}`}>{s.value}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                <hr className="border-slate-800/60" />
                <p className="text-[10px] text-slate-600 text-center">Click any message to inspect its delivery details</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-600 text-xs gap-2">
                <Terminal size={28} className="opacity-15" />
                <span>Select a conversation to view details</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

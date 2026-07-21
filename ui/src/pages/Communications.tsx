import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../utils/api';
import { 
  Search, MessageSquare, Clock, Check, CheckCheck, AlertCircle, 
  CornerDownLeft, Zap, FileText, Terminal, Copy, User, X 
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function Communications() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Fetch all conversations summary
  const { data: conversationsData, isLoading: isLoadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await apiFetch('/api/v1/messages/conversations');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const json = await response.json();
      return (json.conversations || []) as ConversationSummary[];
    },
    refetchInterval: 4000,
  });

  const conversations = conversationsData || [];

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (conversations.length > 0 && !selectedRecipient) {
      setSelectedRecipient(conversations[0].recipient);
    }
  }, [conversations, selectedRecipient]);

  // Fetch full chat timeline for selected recipient
  const { data: chatData, isLoading: isLoadingChat } = useQuery({
    queryKey: ['conversationMessages', selectedRecipient],
    queryFn: async () => {
      if (!selectedRecipient) return [];
      const response = await apiFetch(`/api/v1/messages/conversations/${selectedRecipient}`);
      if (!response.ok) throw new Error('Failed to fetch conversation messages');
      const json = await response.json();
      return (json.messages || []) as ChatMessage[];
    },
    enabled: !!selectedRecipient,
    refetchInterval: 3000,
  });

  const chatMessages = chatData || [];

  // Auto-select newest outgoing message or last message for the inspector panel
  useEffect(() => {
    if (chatMessages.length > 0 && !selectedMessageId) {
      const lastOutbound = [...chatMessages].reverse().find(m => m.direction === 'OUTGOING');
      if (lastOutbound) {
        setSelectedMessageId(lastOutbound.id);
      } else {
        setSelectedMessageId(chatMessages[chatMessages.length - 1].id);
      }
    }
  }, [chatMessages, selectedMessageId]);

  const selectedMessage = chatMessages.find(m => m.id === selectedMessageId);

  const filteredConversations = conversations.filter(c => 
    c.recipient.includes(searchQuery) || 
    c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const generateDebugReport = async () => {
    if (!selectedMessage || selectedMessage.direction !== 'OUTGOING') return;
    setIsGeneratingReport(true);
    
    try {
      const response = await apiFetch(`/api/v1/webhook-inspector?search=${selectedMessage.messageId}&limit=100`);
      let webhooksData = [];
      if (response.ok) {
        const json = await response.json();
        webhooksData = json.data || [];
      }

      let report = `===================================
KAMNA GATEWAY DEBUG REPORT
===================================

Communication ID: ${selectedMessage.messageId}
Event ID: ${selectedMessage.eventId}
Recipient: ${selectedMessage.recipient}
Template: ${selectedMessage.template}
Channel: ${selectedMessage.channel}
Created At: ${new Date(selectedMessage.createdAt || selectedMessage.timestamp).toLocaleString()}
Current Status: ${selectedMessage.status}

--- Timeline ---
`;

      if (selectedMessage.timeline && selectedMessage.timeline.length > 0) {
        selectedMessage.timeline.forEach((t: any) => {
          report += `${new Date(t.createdAt).toLocaleTimeString()} ${t.status} - ${t.description}\n`;
        });
      } else {
        report += `No timeline recorded.\n`;
      }

      const finalPayload = selectedMessage.timeline?.find((t: any) => t.description === 'Template Sent')?.metadata?.payload || {};

      report += `
--- Provider Information ---
Provider Message ID: ${selectedMessage.providerMessageId || 'N/A'}
HTTP Status: ${selectedMessage.providerHttpStatus || 'N/A'}
Latency: ${selectedMessage.providerLatency ? selectedMessage.providerLatency + 'ms' : 'N/A'}
Accepted Timestamp: ${selectedMessage.acceptedAt ? new Date(selectedMessage.acceptedAt).toLocaleString() : 'N/A'}
Provider Status: ${selectedMessage.providerStatus || 'N/A'}

--- Final Payload ---
${JSON.stringify(finalPayload, null, 2)}

--- Provider Response ---
${JSON.stringify(selectedMessage.providerResponse || {}, null, 2)}
`;

      if (selectedMessage.status === 'FAILED') {
        report += `
--- Failure Details ---
${JSON.stringify(selectedMessage.providerResponse || {}, null, 2)}
`;
      }

      report += `
--- Latest Webhooks ---
`;
      if (webhooksData.length > 0) {
        webhooksData.forEach((w: any) => {
          report += `Timestamp: ${w.receivedAt ? new Date(w.receivedAt).toLocaleString() : 'N/A'}
Webhook Type: ${w.eventType || 'Unknown'}
Matched Provider Message ID: ${w.matchedProviderMessageId || 'N/A'}
Status Transition: ${w.processingStatus}
Processing Result: ${w.errorMessage || 'Success'}
Raw Payload: ${w.rawBody}
------------------------
`;
        });
      } else {
        report += `No webhooks found for this communication.\n`;
      }

      report += `
--- Communication Metadata ---
${JSON.stringify(selectedMessage.metadata || {}, null, 2)}

--- Footer ---
Gateway Version: 0.0.1
Database: SQLite
Provider: ${selectedMessage.provider || 'N/A'}
Generated Timestamp: ${new Date().toLocaleString()}
`;

      await navigator.clipboard.writeText(report);
      toast.success('Debug report copied to clipboard');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate debug report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'QUEUED':
      case 'VALIDATED':
      case 'PROCESSING':
        return <Clock size={14} className="text-slate-500" />;
      case 'SENDING':
      case 'SENT':
      case 'META_ACCEPTED':
        return <Check size={14} className="text-slate-400" />;
      case 'DELIVERED':
        return <CheckCheck size={14} className="text-slate-300" />;
      case 'READ':
        return <CheckCheck size={14} className="text-blue-400 font-bold" />;
      case 'REPLIED':
        return <CornerDownLeft size={14} className="text-pink-400 font-bold" />;
      case 'FAILED':
        return <AlertCircle size={14} className="text-red-500" />;
      default:
        return <Clock size={14} className="text-slate-500" />;
    }
  };

  // Format Date separators
  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { [date: string]: ChatMessage[] } = {};
    messages.forEach(msg => {
      const dateStr = new Date(msg.timestamp).toLocaleDateString(undefined, { 
        year: 'numeric', month: 'short', day: 'numeric' 
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(msg);
    });
    return groups;
  };

  const groupedMessages = groupMessagesByDate(chatMessages);

  return (
    <div className="h-full flex bg-slate-950 text-slate-200 overflow-hidden">
      
      {/* COLUMN 1: LEFT SIDEBAR (340px) */}
      <div className="w-[340px] flex-none border-r border-slate-800 bg-slate-900/60 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="text-indigo-500" size={20} />
              Conversations
            </h1>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
              {conversations.length}
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input 
              type="text" 
              placeholder="Search phone or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-200"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {isLoadingConversations ? (
            <div className="p-8 text-center text-slate-500 text-xs flex justify-center">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.recipient === selectedRecipient;
              return (
                <div 
                  key={conv.recipient}
                  onClick={() => {
                    setSelectedRecipient(conv.recipient);
                    setSelectedMessageId(null);
                  }}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-600/15 border-l-4 border-indigo-500' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-none">
                    <User size={18} className="text-slate-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-sm text-slate-200 truncate">
                        {conv.customerName !== conv.recipient ? conv.customerName : conv.recipient}
                      </span>
                      <span className="text-[10px] text-slate-500 flex-none ml-2">
                        {new Date(conv.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 text-xs">
                      <p className="text-slate-400 truncate text-[11px] flex-1">
                        {conv.lastMessage.direction === 'OUTGOING' ? `[${conv.lastMessage.template}]` : conv.lastMessage.text}
                      </p>
                      
                      {conv.lastMessage.direction === 'OUTGOING' && (
                        <span className="flex-none">
                          {renderStatusIcon(conv.lastMessage.status)}
                        </span>
                      )}

                      {conv.unread && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 flex-none" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* COLUMN 2: MAIN CHAT PANEL (FLEX 1) */}
      <div className="flex-1 flex flex-col bg-slate-950 min-w-0 border-r border-slate-800">
        {selectedRecipient ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between flex-none">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                  <User size={18} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-base leading-tight">{selectedRecipient}</h2>
                  <span className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    WhatsApp Direct • {chatMessages.length} Messages
                  </span>
                </div>
              </div>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isLoadingChat ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : Object.keys(groupedMessages).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                  <MessageSquare size={36} className="mb-2 opacity-30" />
                  No message history for this conversation.
                </div>
              ) : (
                Object.entries(groupedMessages).map(([dateStr, msgs]) => (
                  <div key={dateStr} className="space-y-4">
                    {/* Date Separator */}
                    <div className="flex items-center justify-center my-4">
                      <span className="bg-slate-900 border border-slate-800 text-slate-400 text-[11px] px-3 py-1 rounded-full font-medium shadow-sm">
                        {dateStr}
                      </span>
                    </div>

                    {/* Messages in Date */}
                    {msgs.map((msg) => {
                      const isOutgoing = msg.direction === 'OUTGOING';
                      const isSelected = msg.id === selectedMessageId;

                      return (
                        <div 
                          key={msg.id}
                          onClick={() => setSelectedMessageId(msg.id)}
                          className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'} cursor-pointer group`}
                        >
                          <div 
                            className={`max-w-[75%] rounded-2xl p-4 transition-all shadow-md ${
                              isOutgoing 
                                ? 'bg-indigo-600 text-white rounded-br-none hover:bg-indigo-500' 
                                : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none hover:border-slate-700'
                            } ${isSelected ? 'ring-2 ring-offset-2 ring-offset-slate-950 ring-indigo-400' : ''}`}
                          >
                            {/* Header / Template Badge */}
                            {isOutgoing && (
                              <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-indigo-400/30 text-xs">
                                <span className="font-mono text-[11px] bg-indigo-900/60 text-indigo-200 px-2 py-0.5 rounded font-semibold">
                                  Template: {msg.template}
                                </span>
                                <span className="text-[10px] opacity-75">ID: {msg.messageId?.substring(0, 8)}...</span>
                              </div>
                            )}

                            {/* Body Text / Preview */}
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">
                              {isOutgoing ? (
                                msg.variables && Array.isArray(msg.variables) && msg.variables.length > 0 ? (
                                  <div>
                                    <p className="font-medium text-xs opacity-90 mb-1">Variables:</p>
                                    <ul className="list-disc pl-4 text-xs space-y-0.5 opacity-90">
                                      {msg.variables.map((v: any, i: number) => (
                                        <li key={i}><span className="font-mono opacity-75">{`{{${i+1}}}`}:</span> {String(v)}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <p className="italic text-xs opacity-80">Standard Template Push</p>
                                )
                              ) : (
                                <p>{msg.text || `[Media / ${msg.messageType}]`}</p>
                              )}
                            </div>

                            {/* Footer: Time & Status */}
                            <div className="flex items-center justify-end gap-1.5 mt-2 text-[10px] opacity-80">
                              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isOutgoing && (
                                <span className="ml-1">
                                  {renderStatusIcon(msg.status)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
            <MessageSquare size={48} className="mb-3 opacity-20" />
            Select a conversation to start viewing messages.
          </div>
        )}
      </div>

      {/* COLUMN 3: RIGHT SIDEBAR - EMBEDDED MESSAGE INSPECTOR (380px) */}
      <div className="w-[380px] flex-none border-l border-slate-800 bg-slate-900/70 flex flex-col overflow-y-auto">
        {selectedMessage ? (
          <div className="p-5 space-y-6">
            
            {/* Header / Actions */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Terminal size={18} className="text-indigo-400" />
                  Message Inspector
                </h3>
                <span className="font-mono text-[11px] text-slate-400">
                  {selectedMessage.messageId || selectedMessage.id}
                </span>
              </div>
              <button 
                onClick={() => setSelectedMessageId(null)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Action Buttons */}
            {selectedMessage.direction === 'OUTGOING' && (
              <div className="flex flex-col gap-2">
                <button 
                  onClick={generateDebugReport}
                  disabled={isGeneratingReport}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                  <FileText size={14} /> {isGeneratingReport ? 'Generating Report...' : 'Copy Debug Report'}
                </button>
                
                {selectedMessage.messageId && (
                  <a 
                    href={`/dashboard/settings/diagnostics/webhooks?search=${selectedMessage.messageId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 py-2 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    <Zap size={14} /> View Webhooks in Diagnostics
                  </a>
                )}
              </div>
            )}

            {/* Selected Overview */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overview</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Direction</span>
                  <span className={`font-semibold ${selectedMessage.direction === 'OUTGOING' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                    {selectedMessage.direction}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Status</span>
                  <span className="font-bold text-slate-200">{selectedMessage.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Recipient</span>
                  <span className="font-mono text-slate-300">{selectedMessage.recipient}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Template</span>
                  <span className="font-mono text-slate-300">{selectedMessage.template || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Delivery Timeline */}
            {selectedMessage.direction === 'OUTGOING' && selectedMessage.timeline && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Timeline</h4>
                <div className="relative pl-5 border-l-2 border-slate-800 space-y-4">
                  {selectedMessage.timeline.map((step: any, idx: number) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-950" />
                      <div className="text-xs">
                        <p className="font-medium text-slate-200">{step.description || step.status}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{new Date(step.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Provider Info */}
            {selectedMessage.direction === 'OUTGOING' && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Provider Info</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Provider</span>
                    <span className="text-slate-300 font-medium">{selectedMessage.provider || 'Meta WhatsApp'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">HTTP Status</span>
                    <span className="font-mono text-emerald-400 font-bold">{selectedMessage.providerHttpStatus || '200 OK'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[10px]">Provider Message ID</span>
                    <span className="font-mono text-[11px] text-slate-300 truncate block">
                      {selectedMessage.providerMessageId || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Raw Metadata & Payload */}
            <div className="space-y-4">
              {selectedMessage.variables && (
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
                    <span className="text-xs font-semibold text-slate-300">Variables JSON</span>
                    <button 
                      onClick={() => handleCopy(JSON.stringify(selectedMessage.variables, null, 2), 'vars')}
                      className="text-slate-500 hover:text-white"
                    >
                      {copiedSection === 'vars' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <pre className="p-3 text-[11px] font-mono text-indigo-300 overflow-x-auto max-h-40">
                    {JSON.stringify(selectedMessage.variables, null, 2)}
                  </pre>
                </div>
              )}

              {selectedMessage.metadata && (
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
                    <span className="text-xs font-semibold text-slate-300">Metadata JSON</span>
                    <button 
                      onClick={() => handleCopy(JSON.stringify(selectedMessage.metadata, null, 2), 'meta')}
                      className="text-slate-500 hover:text-white"
                    >
                      {copiedSection === 'meta' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <pre className="p-3 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-40">
                    {JSON.stringify(selectedMessage.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
            <Terminal size={32} className="mb-2 opacity-20" />
            Click any message in the chat timeline to inspect its delivery timeline and provider payload.
          </div>
        )}
      </div>

    </div>
  );
}

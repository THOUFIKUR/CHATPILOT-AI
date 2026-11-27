import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Paperclip, 
  Plus, 
  Trash2, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCw, 
  Copy, 
  Check, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Search, 
  MessageSquare,
  ArrowUp,
  X,
  Sliders,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  FolderGit2,
  Mail,
  Calendar,
  Database,
  GitBranch,
  Boxes,
  RotateCcw,
  Square,
  LayoutGrid
} from 'lucide-react';
import { API_BASE } from '../lib/api';

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AttachedFile[];
  metadata?: {
    provider?: string;
    model?: string;
    latency_ms?: number;
  };
  created_at: string;
}

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Connector {
  id: string;
  name: string;
  category: string;
  status: string;
  enabled?: boolean;
  account: string;
  permissions: string[];
  tools: Array<{ name: string; description: string; type: string }>;
  last_sync?: string;
}

export const AssistantChatView: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchSession, setSearchSession] = useState('');
  
  // Model & contact context
  const [selectedModel, setSelectedModel] = useState('Groq Qwen-3.8');
  const [selectedContact, setSelectedContact] = useState<string>('Parveen');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Attachments state
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Claude-Style Connector Popover & Modal States
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showPluginsFlyout, setShowPluginsFlyout] = useState(false);
  const [pluginSearchText, setPluginSearchText] = useState('');
  const [showConnectorsModal, setShowConnectorsModal] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [activeConnectorDetail, setActiveConnectorDetail] = useState<Connector | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'connected' | 'not_connected' | 'attention'>('all');
  const [directorySearch, setDirectorySearch] = useState('');

  // Add MCP Server modal state
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpTransport, setNewMcpTransport] = useState<'stdio' | 'sse' | 'http'>('stdio');
  const [newMcpCommand, setNewMcpCommand] = useState('');
  const [testingConnectorId, setTestingConnectorId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning thoughts';
    if (hour < 18) return 'Afternoon thoughts';
    return 'Evening thoughts';
  };

  useEffect(() => {
    loadSessions();
    loadConnectors();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/assistant/sessions`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSessions(data);
        setActiveSessionId(data[0].id);
      } else {
        createNewSession();
      }
    } catch {
      createNewSession();
    }
  };

  const loadConnectors = async () => {
    try {
      const res = await fetch(`${API_BASE}/connectors`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setConnectors(data);
      }
    } catch (e) {
      console.error('Failed to load connectors', e);
    }
  };

  const handleToggleConnector = async (id: string, currentEnabled?: boolean) => {
    try {
      await fetch(`${API_BASE}/connectors/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      setConnectors(prev => prev.map(c => c.id === id ? { ...c, enabled: !currentEnabled } : c));
    } catch {
      setConnectors(prev => prev.map(c => c.id === id ? { ...c, enabled: !currentEnabled } : c));
    }
  };

  const handleTestConnector = async (id: string) => {
    setTestingConnectorId(id);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/connectors/${id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTestingConnectorId(null);
    }
  };

  const handleAddMcpServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMcpName || !newMcpCommand) return;
    try {
      const res = await fetch(`${API_BASE}/connectors/mcp/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMcpName,
          transport: newMcpTransport,
          command_or_url: newMcpCommand,
          environment_variables: {}
        })
      });
      const data = await res.json();
      if (data.server) {
        setConnectors(prev => [...prev, data.server]);
      }
      setShowAddMcpModal(false);
      setNewMcpName('');
      setNewMcpCommand('');
    } catch (e) {
      console.error(e);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/assistant/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New chat' })
      });
      const newSession = await res.json();
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
    } catch {
      const localId = 'session-' + Date.now();
      const localSession = {
        id: localId,
        title: 'New chat',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setSessions(prev => [localSession, ...prev]);
      setActiveSessionId(localId);
      setMessages([]);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/assistant/sessions/${sessionId}/messages`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch {
      setMessages([]);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE}/assistant/sessions/${sessionId}`, { method: 'DELETE' });
      const nextSessions = sessions.filter(s => s.id !== sessionId);
      setSessions(nextSessions);
      if (activeSessionId === sessionId) {
        if (nextSessions.length > 0) {
          setActiveSessionId(nextSessions[0].id);
        } else {
          createNewSession();
        }
      }
    } catch {
      // ignore
    }
  };

  // Handle File Input Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      const isText = file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.csv');

      if (isText) {
        reader.onload = (ev) => {
          setAttachments(prev => [...prev, {
            id: 'file-' + Date.now() + Math.random(),
            name: file.name,
            type: file.type || 'text/plain',
            size: file.size,
            content: (ev.target?.result as string) || ''
          }]);
        };
        reader.readAsText(file);
      } else {
        reader.onload = (ev) => {
          setAttachments(prev => [...prev, {
            id: 'file-' + Date.now() + Math.random(),
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            content: (ev.target?.result as string) || ''
          }]);
        };
        reader.readAsDataURL(file);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if ((!text && attachments.length === 0) || loading) return;

    const currentAttachments = [...attachments];
    setInputText('');
    setAttachments([]);
    setShowModelMenu(false);
    setShowAttachMenu(false);

    const userMsg: Message = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: text || (currentAttachments.length > 0 ? `Attached ${currentAttachments.map(a => a.name).join(', ')}` : ''),
      attachments: currentAttachments,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      let currentId = activeSessionId;
      if (!currentId) {
        const newSessionRes = await fetch(`${API_BASE}/assistant/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.slice(0, 30) || 'Attachment Inquest' })
        });
        const newSession = await newSessionRes.json();
        currentId = newSession.id;
        setActiveSessionId(currentId);
        setSessions(prev => [newSession, ...prev]);
      }

      const res = await fetch(`${API_BASE}/assistant/sessions/${currentId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          attachments: currentAttachments,
          provider: selectedModel.toLowerCase().includes('gemini') ? 'gemini' : selectedModel.toLowerCase().includes('openrouter') ? 'openrouter' : 'groq',
          model: selectedModel.toLowerCase().includes('gemini') ? 'gemini-flash-lite-latest' : selectedModel.toLowerCase().includes('openrouter') ? 'deepseek/deepseek-chat' : 'qwen/qwen3.8-27b',
          contact_filter: selectedContact
        })
      });

      const data = await res.json();
      if (data.assistant_message) {
        setMessages(prev => [...prev, data.assistant_message]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: 'asst-' + Date.now(),
            role: 'assistant',
            content: data.reply || data.content || "I have received your message.",
            metadata: {
              provider: data.provider || 'groq',
              model: data.model || 'qwen/qwen3.8-27b',
              latency_ms: data.latency_ms
            },
            created_at: new Date().toISOString()
          }
        ]);
      }

      if (messages.length <= 1) {
        setSessions(prev => prev.map(s => s.id === currentId ? { ...s, title: (text || 'Document Review').slice(0, 30) } : s));
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          content: "Sorry, I encountered an issue connecting to the model or tools.",
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredSessions = sessions.filter(s =>
    (s.title || '').toLowerCase().includes(searchSession.toLowerCase())
  );

  return (
    <div className="flex h-screen w-full bg-[#fbf9f6] text-[#1b1c1a] overflow-hidden font-sans relative">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.csv,.docx,.xlsx"
        className="hidden"
      />

      {/* 1. SIDEBAR */}
      <aside className={`transition-all duration-300 ease-in-out z-20 flex flex-col h-full bg-[#f5f3f0] border-r border-[#c6c6cb]/60 ${
        sidebarOpen ? 'w-64 md:w-72' : 'w-0 -translate-x-full overflow-hidden border-none'
      }`}>
        <div className="p-3 border-b border-[#c6c6cb]/50 flex items-center justify-between">
          <button
            onClick={createNewSession}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-[#eae8e5] text-[#1b1c1a] border border-[#c6c6cb] rounded-xl text-xs font-semibold shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New chat</span>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 ml-2 rounded-lg text-[#76777c] hover:bg-[#eae8e5] transition"
            title="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#76777c]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchSession}
              onChange={(e) => setSearchSession(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#c6c6cb]/70 rounded-lg text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <span className="font-mono text-[10px] font-bold uppercase text-[#76777c] px-2 block mb-1">
            RECENTS
          </span>
          {filteredSessions.map((s) => {
            const isActive = activeSessionId === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                  isActive
                    ? 'bg-white font-bold text-[#1b1c1a] shadow-2xs border border-[#c6c6cb]/60'
                    : 'text-[#46464b] hover:bg-[#eae8e5]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#76777c]" />
                  <span className="truncate">{s.title || 'Untitled'}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 transition"
                  title="Delete chat"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2. MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-14 border-b border-[#c6c6cb]/50 flex items-center justify-between px-4 md:px-6 bg-[#fbf9f6]/80 backdrop-blur-xs z-10">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg text-[#76777c] hover:bg-[#efeeeb] transition"
                title="Open sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-serif font-bold text-base text-[#1b1c1a]">Ask ChatPilot</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Extensions & MCP Tools Button */}
            <button
              onClick={() => setShowConnectorsModal(true)}
              className="px-3 py-1 bg-white hover:bg-[#efeeeb] border border-[#c6c6cb] rounded-full font-mono text-[11px] font-bold text-[#1b1c1a] flex items-center gap-1.5 shadow-2xs transition"
            >
              <Boxes className="w-3.5 h-3.5 text-[#ac3400]" />
              <span>Connectors & Tools ({connectors.length || 6})</span>
            </button>

            {/* Model Pill */}
            <div className="px-2.5 py-1 bg-[#efeeeb] border border-[#c6c6cb]/60 rounded-full font-mono text-[11px] font-bold text-[#46464b] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              <span>{selectedModel}</span>
            </div>
          </div>
        </header>

        {/* Chat Scroll Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {messages.length === 0 ? (
            /* EMPTY STATE */
            <div className="max-w-2xl mx-auto mt-12 md:mt-24 text-center space-y-6">
              <div className="inline-flex items-center gap-2">
                <span className="text-[#ac3400] text-xl font-serif">✻</span>
                <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-[#1b1c1a]">
                  {getGreeting()}
                </h1>
              </div>

              {/* Big Centered Claude-style Input Box */}
              <div className="bg-white border border-[#c6c6cb] rounded-2xl shadow-sm p-4 text-left space-y-3">
                {/* Attachments preview */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-2 border-b border-[#c6c6cb]/30">
                    {attachments.map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#efeeeb] rounded-xl text-xs font-mono text-[#1b1c1a] border border-[#c6c6cb]/60">
                        <FileText className="w-3.5 h-3.5 text-[#ac3400]" />
                        <span className="truncate max-w-[140px]">{a.name}</span>
                        <span className="text-[#76777c] text-[10px]">({(a.size/1024).toFixed(0)}KB)</span>
                        <button onClick={() => handleRemoveAttachment(a.id)} className="hover:text-rose-600 p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  rows={3}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="How can I help you today? (e.g. 'Make Parveen auto reply and select', 'Search my Drive', or attach files)"
                  className="w-full bg-transparent resize-none text-base text-[#1b1c1a] placeholder:text-[#76777c] focus:outline-none"
                />

                <div className="flex items-center justify-between pt-2 border-t border-[#c6c6cb]/30">
                  <div className="flex items-center gap-2">
                    {/* Claude-style Plus Button & Popover */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPlusMenu(!showPlusMenu);
                          setShowPluginsFlyout(false);
                        }}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition border ${
                          showPlusMenu ? 'bg-[#1b1c1a] text-white border-[#1b1c1a]' : 'bg-[#f5f3f0] text-[#5e5f63] hover:text-[#1b1c1a] hover:bg-[#ede5dc] border-[#e3dad1]'
                        }`}
                        title="Upload files, add plugins, or configure MCP tools"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      {/* Level 1 Popover Menu */}
                      {showPlusMenu && (
                        <div className="absolute left-0 bottom-9 z-40 w-56 bg-white border border-[#c6c6cb] rounded-2xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              fileInputRef.current?.click();
                              setShowPlusMenu(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#1b1c1a] hover:bg-[#fbf9f6] transition group"
                          >
                            <span className="flex items-center gap-2.5 font-medium">
                              <Paperclip className="w-4 h-4 text-[#76777c] group-hover:text-[#c84b1a]" />
                              <span>Upload or add files</span>
                            </span>
                            <span className="font-mono text-[10px] text-[#8a8b90]">Ctrl+U</span>
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowPluginsFlyout(!showPluginsFlyout)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition group ${
                                showPluginsFlyout ? 'bg-[#fbf9f6] text-[#c84b1a] font-bold' : 'text-[#1b1c1a] hover:bg-[#fbf9f6]'
                              }`}
                            >
                              <span className="flex items-center gap-2.5 font-medium">
                                <Boxes className="w-4 h-4 text-[#76777c] group-hover:text-[#c84b1a]" />
                                <span>Plugins & Connectors</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-[#f3d9c3] text-[#c84b1a]">
                                  {connectors.filter(c => c.enabled !== false).length}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-[#8a8b90]" />
                              </span>
                            </button>

                            {/* Level 2 Secondary Flyout Menu (matching Claude reference image) */}
                            {showPluginsFlyout && (
                              <div className="absolute left-full bottom-0 ml-2 w-64 bg-white border border-[#c6c6cb] rounded-2xl shadow-2xl p-2.5 space-y-2 z-50 animate-in fade-in duration-150">
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 text-[#8a8b90] absolute left-2.5 top-2.5 pointer-events-none" />
                                  <input
                                    type="text"
                                    value={pluginSearchText}
                                    onChange={(e) => setPluginSearchText(e.target.value)}
                                    placeholder="Search plugins"
                                    className="w-full pl-8 pr-2 py-1.5 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-xs text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a]"
                                  />
                                </div>

                                <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                                  {connectors
                                    .filter(c => !pluginSearchText || c.name.toLowerCase().includes(pluginSearchText.toLowerCase()))
                                    .map(c => (
                                      <div key={c.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-[#fbf9f6] transition text-xs">
                                        <span className="flex items-center gap-2 font-medium text-[#1b1c1a] truncate">
                                          {c.id === 'github' ? <GitBranch className="w-3.5 h-3.5 text-[#1b1c1a]" />
                                           : c.id === 'google_drive' ? <FolderGit2 className="w-3.5 h-3.5 text-blue-600" />
                                           : c.id === 'gmail' ? <Mail className="w-3.5 h-3.5 text-red-600" />
                                           : c.id === 'google_calendar' ? <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                           : c.id === 'supabase' ? <Database className="w-3.5 h-3.5 text-emerald-700" />
                                           : <Boxes className="w-3.5 h-3.5 text-[#c84b1a]" />}
                                          <span className="truncate">{c.name}</span>
                                        </span>
                                        
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleConnector(c.id, c.enabled !== false);
                                          }}
                                          className={`w-7 h-4 rounded-full transition p-0.5 flex items-center ${
                                            c.enabled !== false ? 'bg-[#c84b1a] justify-end' : 'bg-[#c6c6cb] justify-start'
                                          }`}
                                        >
                                          <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                                        </button>
                                      </div>
                                    ))}
                                </div>

                                <div className="border-t border-[#ede5dc] pt-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowConnectorsModal(true);
                                      setShowPlusMenu(false);
                                      setShowPluginsFlyout(false);
                                    }}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#c84b1a] hover:bg-[#fbf9f6] transition"
                                  >
                                    <span>⚙ Manage plugins</span>
                                    <span className="text-[11px]">↗</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono text-[#46464b] hover:bg-[#efeeeb] transition"
                    >
                      <span>+ {selectedContact}</span>
                      <ChevronDown className="w-2.5 h-2.5 text-[#76777c]" />
                    </button>

                    {showAttachMenu && (
                      <div className="absolute left-10 bottom-24 z-30 w-44 bg-white border border-[#c6c6cb] rounded-xl shadow-lg p-1 space-y-0.5">
                        {['Parveen', 'Afiza 🌷🤍', 'All Contacts'].map(c => (
                          <button
                            key={c}
                            onClick={() => { setSelectedContact(c); setShowAttachMenu(false); }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-serif ${
                              selectedContact === c ? 'bg-[#1b1c1a] text-white font-bold' : 'hover:bg-[#efeeeb]'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputText.trim() && attachments.length === 0}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                        (inputText.trim() || attachments.length > 0)
                          ? 'bg-[#1b1c1a] text-white hover:bg-[#ac3400] active:scale-95'
                          : 'bg-[#c6c6cb] text-white cursor-not-allowed'
                      }`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Suggestions pills */}
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {[
                  "Enable Parveen's auto-reply",
                  "Disable Afiza",
                  "Search my Drive for project doc",
                  "Show my calendar for tomorrow",
                  "What did Parveen message today?"
                ].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(s)}
                    className="px-3.5 py-1.5 rounded-full bg-[#efeeeb] hover:bg-[#e4e2df] text-xs text-[#46464b] transition font-serif shadow-2xs"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* CONVERSATION MESSAGE LIST */
            <div className="max-w-3xl mx-auto space-y-6 pb-32">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-2xl bg-[#1b1c1a] text-[#ffb59d] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                    <div className="max-w-[85%] md:max-w-[75%] space-y-1.5">
                      {/* Attached files preview in message */}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 justify-end mb-1">
                          {m.attachments.map(att => (
                            <span key={att.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#efeeeb] rounded-lg font-mono text-[10px] text-[#46464b] border border-[#c6c6cb]/40">
                              <FileText className="w-3 h-3 text-[#ac3400]" />
                              {att.name}
                            </span>
                          ))}
                        </div>
                      )}

                      <div
                        className={`p-4 rounded-2xl text-sm leading-relaxed ${
                          isUser
                            ? 'bg-[#1b1c1a] text-white rounded-tr-xs'
                            : 'bg-white border border-[#c6c6cb]/70 text-[#1b1c1a] rounded-tl-xs shadow-2xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap font-sans">{m.content}</p>
                      </div>

                      {/* Assistant message metadata / copy */}
                      {!isUser && (
                        <div className="flex items-center gap-3 text-[10px] font-mono text-[#76777c] px-1">
                          <span>{m.metadata?.model || selectedModel}</span>
                          {m.metadata?.latency_ms ? <span>~{m.metadata.latency_ms}ms</span> : null}
                          <button
                            onClick={() => handleCopy(m.id, m.content)}
                            className="hover:text-[#1b1c1a] transition flex items-center gap-1"
                          >
                            {copiedId === m.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-2xl bg-[#1b1c1a] text-[#ffb59d] flex items-center justify-center shrink-0 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="px-4 py-2.5 bg-white border border-[#c6c6cb]/70 rounded-2xl text-xs font-mono text-[#76777c] flex items-center gap-2 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-[#ac3400] animate-pulse"></span>
                    <span>ChatPilot is processing tools & reasoning...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating Bottom Input Bar for Active Chat */}
        {messages.length > 0 && (
          <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center pointer-events-none">
            <div className="w-full max-w-3xl bg-white border border-[#c6c6cb] rounded-2xl shadow-lg p-3 pointer-events-auto space-y-2">
              {/* Attachments preview inside active chat */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2 border-b border-[#c6c6cb]/30">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 px-2 py-0.5 bg-[#efeeeb] rounded-lg text-xs font-mono text-[#1b1c1a] border border-[#c6c6cb]/60">
                      <FileText className="w-3 h-3 text-[#ac3400]" />
                      <span className="truncate max-w-[120px]">{a.name}</span>
                      <button onClick={() => handleRemoveAttachment(a.id)} className="hover:text-rose-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Reply to ChatPilot or instruct tool actions..."
                className="w-full bg-transparent resize-none text-sm text-[#1b1c1a] placeholder:text-[#76777c] focus:outline-none max-h-32"
              />

              <div className="flex items-center justify-between pt-1 border-t border-[#c6c6cb]/30">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(!showPlusMenu);
                      setShowPluginsFlyout(false);
                    }}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition border ${
                      showPlusMenu ? 'bg-[#1b1c1a] text-white border-[#1b1c1a]' : 'bg-[#f5f3f0] text-[#5e5f63] hover:text-[#1b1c1a] hover:bg-[#ede5dc] border-[#e3dad1]'
                    }`}
                    title="Upload files, add plugins, or configure MCP tools"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1 rounded-lg text-[#76777c] hover:text-[#1b1c1a] hover:bg-[#efeeeb] transition flex items-center gap-1 text-xs font-mono font-bold"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Attach</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono text-[#46464b] hover:bg-[#efeeeb] transition"
                  >
                    <span>{selectedContact}</span>
                    <ChevronDown className="w-2.5 h-2.5 text-[#76777c]" />
                  </button>

                  {showAttachMenu && (
                    <div className="absolute left-4 bottom-14 z-30 w-44 bg-white border border-[#c6c6cb] rounded-xl shadow-lg p-1 space-y-0.5">
                      {['Parveen', 'Afiza 🌷🤍', 'All Contacts'].map(c => (
                        <button
                          key={c}
                          onClick={() => { setSelectedContact(c); setShowAttachMenu(false); }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-serif ${
                            selectedContact === c ? 'bg-[#1b1c1a] text-white font-bold' : 'hover:bg-[#efeeeb]'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() && attachments.length === 0}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                    (inputText.trim() || attachments.length > 0)
                      ? 'bg-[#1b1c1a] text-white hover:bg-[#ac3400] active:scale-95'
                      : 'bg-[#c6c6cb] text-white cursor-not-allowed'
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. CLAUDE-INSPIRED CONNECTOR & MCP DIRECTORY MODAL */}
      {showConnectorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-[#c6c6cb] shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#ede5dc]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1b1c1a] text-white flex items-center justify-center shadow-md shadow-[#1b1c1a]/15">
                  <Boxes className="w-5 h-5 text-[#f8a88b]" />
                </div>
                <div>
                  <h2 className="font-serif font-bold text-2xl text-[#1b1c1a]">
                    Connector Directory & MCP Ecosystem
                  </h2>
                  <p className="text-xs text-[#76777c] font-sans">
                    Integrate Google Workspace, GitHub, Supabase, and Model Context Protocol tools.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMcpModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#c84b1a] hover:bg-[#a3370b] text-white text-xs font-serif font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add MCP Server</span>
                </button>
                <button
                  onClick={() => {
                    setShowConnectorsModal(false);
                    setActiveConnectorDetail(null);
                  }}
                  className="p-1.5 rounded-xl hover:bg-[#efeeeb] text-[#76777c] hover:text-[#1b1c1a] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {(['all', 'connected', 'not_connected', 'attention'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilterCategory(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-serif capitalize transition ${
                      filterCategory === tab 
                        ? 'bg-[#1b1c1a] text-white font-bold' 
                        : 'bg-[#fbf9f6] border border-[#e3dad1] text-[#5e5f63] hover:text-[#1b1c1a]'
                    }`}
                  >
                    {tab.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#8a8b90] absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Search connectors, tools..."
                  className="w-full pl-8.5 pr-3 py-1.5 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-xs text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a]"
                />
              </div>
            </div>

            {/* Connectors Grid */}
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {connectors
                .filter(conn => {
                  if (filterCategory === 'connected' && conn.status !== 'connected') return false;
                  if (filterCategory === 'not_connected' && conn.status === 'connected') return false;
                  if (filterCategory === 'attention' && conn.status !== 'requires_attention' && conn.status !== 'blocked') return false;
                  if (directorySearch) {
                    const q = directorySearch.toLowerCase();
                    return conn.name.toLowerCase().includes(q) || conn.category.toLowerCase().includes(q);
                  }
                  return true;
                })
                .map((conn) => (
                  <div
                    key={conn.id}
                    onClick={() => setActiveConnectorDetail(conn)}
                    className="p-4 rounded-2xl bg-white border border-[#e3dad1] hover:border-[#c84b1a]/60 hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#fbf9f6] border border-[#ede5dc] flex items-center justify-center text-[#1b1c1a]">
                            {conn.id === 'github' ? <GitBranch className="w-4 h-4 text-[#1b1c1a]" />
                             : conn.id === 'google_drive' ? <FolderGit2 className="w-4 h-4 text-blue-600" />
                             : conn.id === 'gmail' ? <Mail className="w-4 h-4 text-red-600" />
                             : conn.id === 'google_calendar' ? <Calendar className="w-4 h-4 text-emerald-600" />
                             : conn.id === 'google_docs' ? <FileText className="w-4 h-4 text-blue-500" />
                             : conn.id === 'google_sheets' ? <LayoutGrid className="w-4 h-4 text-emerald-600" />
                             : conn.id === 'supabase' ? <Database className="w-4 h-4 text-emerald-700" />
                             : <Boxes className="w-4 h-4 text-[#c84b1a]" />}
                          </div>
                          <div>
                            <h4 className="font-serif font-bold text-sm text-[#1b1c1a] group-hover:text-[#c84b1a] transition">
                              {conn.name}
                            </h4>
                            <span className="text-[10px] font-mono text-[#76777c]">{conn.category}</span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider border ${
                          conn.status === 'connected'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : conn.status === 'requires_attention' || conn.status === 'blocked'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-stone-50 text-stone-700 border-stone-200'
                        }`}>
                          {conn.status}
                        </span>
                      </div>

                      <p className="font-mono text-[11px] text-[#76777c] truncate">{conn.account}</p>
                    </div>

                    {/* Bottom toolbar */}
                    <div className="pt-2 border-t border-[#ede5dc]/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#5e5f63]">
                        <Boxes className="w-3 h-3 text-[#c84b1a]" />
                        <span>{conn.tools.length} active tools</span>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleTestConnector(conn.id)}
                          disabled={testingConnectorId === conn.id}
                          className="px-2 py-0.5 rounded-lg border border-[#c6c6cb] text-[10px] font-mono text-[#46464b] hover:bg-[#efeeeb] transition"
                        >
                          {testingConnectorId === conn.id ? 'Testing...' : 'Test'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleConnector(conn.id, conn.enabled !== false)}
                          className={`w-7 h-4 rounded-full transition p-0.5 flex items-center ${
                            conn.enabled !== false ? 'bg-[#c84b1a] justify-end' : 'bg-[#c6c6cb] justify-start'
                          }`}
                          title={conn.enabled !== false ? 'Enabled for Assistant' : 'Disabled'}
                        >
                          <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Test Connection Live Banner if present */}
            {testResult && (
              <div className="p-3 bg-[#fdfaf6] border border-[#e8cbb6] rounded-2xl flex items-center justify-between text-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-mono text-[#1b1c1a]">{testResult.details || 'Connection verified successfully.'}</span>
                  {testResult.latency_ms && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white border border-[#ede5dc] font-mono text-[10px] text-[#76777c]">
                      {testResult.latency_ms}ms
                    </span>
                  )}
                </div>
                <button onClick={() => setTestResult(null)} className="text-[#76777c] hover:text-[#1b1c1a]">✕</button>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[#ede5dc] flex items-center justify-between text-xs text-[#76777c]">
              <span>Active Connectors: {connectors.filter(c => c.enabled !== false).length} of {connectors.length} enabled</span>
              <button
                onClick={() => {
                  setShowConnectorsModal(false);
                  setActiveConnectorDetail(null);
                }}
                className="px-6 py-2 rounded-xl bg-[#1b1c1a] hover:bg-[#2c2d2a] text-white font-serif text-xs font-bold tracking-wide transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONNECTOR DETAIL & PERMISSION INSPECTOR DRAWER */}
      {activeConnectorDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full max-h-[85vh] rounded-3xl border border-[#c6c6cb] shadow-2xl p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div className="space-y-5 overflow-y-auto pr-1">
              <div className="flex items-center justify-between pb-3 border-b border-[#ede5dc]">
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#1b1c1a]">{activeConnectorDetail.name}</h3>
                  <span className="text-xs text-[#76777c] font-mono">{activeConnectorDetail.category}</span>
                </div>
                <button
                  onClick={() => setActiveConnectorDetail(null)}
                  className="p-1 rounded-lg text-[#76777c] hover:text-[#1b1c1a]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-[#fbf9f6] border border-[#ede5dc] rounded-2xl space-y-1 font-mono text-xs">
                <div className="text-[#76777c]">ACCOUNT IDENTITY:</div>
                <div className="font-bold text-[#1b1c1a]">{activeConnectorDetail.account}</div>
                <div className="text-[10px] text-[#8a8b90] pt-1">LAST SYNC: {activeConnectorDetail.last_sync || 'Live Session'}</div>
              </div>

              {/* Permissions list */}
              <div className="space-y-2">
                <h5 className="font-serif text-xs font-bold text-[#1b1c1a] uppercase tracking-wider">
                  Granted Scopes & Permissions:
                </h5>
                <div className="space-y-1.5">
                  {activeConnectorDetail.permissions.map(p => (
                    <div key={p} className="p-2 bg-[#fdfaf6] border border-[#ede5dc] rounded-xl flex items-center gap-2 text-xs font-mono text-[#46464b]">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Available Tools */}
              <div className="space-y-2">
                <h5 className="font-serif text-xs font-bold text-[#1b1c1a] uppercase tracking-wider">
                  Assistant Tools & Capabilities:
                </h5>
                <div className="space-y-2">
                  {activeConnectorDetail.tools.map(t => (
                    <div key={t.name} className="p-2.5 bg-white border border-[#e3dad1] rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#c84b1a]">{t.name}</span>
                        <span className={`px-1.5 py-0.5 rounded-md font-mono text-[9px] uppercase ${
                          t.type === 'read_only' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {t.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5e5f63] leading-relaxed">{t.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#ede5dc] flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestConnector(activeConnectorDetail.id)}
                disabled={testingConnectorId === activeConnectorDetail.id}
                className="flex-1 py-2.5 rounded-xl border border-[#c6c6cb] hover:bg-[#efeeeb] text-xs font-serif font-bold text-[#1b1c1a] transition"
              >
                {testingConnectorId === activeConnectorDetail.id ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="button"
                onClick={() => setActiveConnectorDetail(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1b1c1a] hover:bg-[#2c2d2a] text-white text-xs font-serif font-bold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADD MCP SERVER MODAL */}
      {showAddMcpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#c6c6cb] shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#ede5dc]">
              <div className="flex items-center gap-2.5">
                <Boxes className="w-5 h-5 text-[#c84b1a]" />
                <h3 className="font-serif text-lg font-bold text-[#1b1c1a]">Register MCP Server</h3>
              </div>
              <button onClick={() => setShowAddMcpModal(false)} className="text-[#76777c] hover:text-[#1b1c1a]">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMcpServer} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-serif font-bold text-[#1b1c1a]">Server Identifier Name</label>
                <input
                  type="text"
                  required
                  value={newMcpName}
                  onChange={(e) => setNewMcpName(e.target.value)}
                  placeholder="e.g. Filesystem Tools or PostgreSQL MCP"
                  className="w-full px-3 py-2 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-[#1b1c1a] focus:outline-none focus:border-[#c84b1a]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-serif font-bold text-[#1b1c1a]">Transport Protocol</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['stdio', 'sse', 'http'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewMcpTransport(t)}
                      className={`py-1.5 rounded-xl border font-mono uppercase text-[11px] transition ${
                        newMcpTransport === t
                          ? 'bg-[#1b1c1a] text-white border-[#1b1c1a] font-bold'
                          : 'bg-[#fbf9f6] border-[#e3dad1] text-[#5e5f63]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-serif font-bold text-[#1b1c1a]">
                  {newMcpTransport === 'stdio' ? 'Command Line Entrypoint' : 'Server Endpoint URL'}
                </label>
                <input
                  type="text"
                  required
                  value={newMcpCommand}
                  onChange={(e) => setNewMcpCommand(e.target.value)}
                  placeholder={newMcpTransport === 'stdio' ? 'npx -y @modelcontextprotocol/server-filesystem C:\\' : 'http://localhost:8080/sse'}
                  className="w-full px-3 py-2 font-mono bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-[#1b1c1a] focus:outline-none focus:border-[#c84b1a]"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMcpModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#c6c6cb] text-xs font-serif font-bold text-[#5e5f63] hover:bg-[#efeeeb] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#c84b1a] hover:bg-[#a3370b] text-white text-xs font-serif font-bold transition shadow-md shadow-[#c84b1a]/25"
                >
                  Connect & Discover
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

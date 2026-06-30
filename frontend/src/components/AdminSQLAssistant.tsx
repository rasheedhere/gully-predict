import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Plus, Trash2, List, Terminal, X, ChevronUp, ChevronDown, Send, Loader2, MessageSquare } from 'lucide-react';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';

interface SQLMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sql?: string;
  results?: any[];
  error?: string;
  chart_config?: any;
}

interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

function QuickChart({ data, config }: { data: any[]; config: any }) {
  if (!config || !data || data.length === 0) return null;
  const xAxis = config.x_key || config.xAxis;
  const yAxis = config.y_key || config.yAxis;
  const chartType = config.chart_type || config.type || 'none';

  if (chartType === 'none' || !xAxis || !yAxis) return null;

  const points = data.map(item => ({
    label: String(item[xAxis] || ''),
    value: Number(item[yAxis] || 0)
  })).filter(item => !isNaN(item.value));

  if (points.length === 0) return null;

  const maxValue = Math.max(...points.map(p => p.value), 1);

  return (
    <div className="mt-4 p-4 bg-black/45 rounded-2xl border border-white/10 backdrop-blur-md">
      <h4 className="text-[11px] font-display text-ipl-gold mb-3 uppercase tracking-widest font-bold">{config.title || 'Data Insights'}</h4>
      
      {chartType === 'pie' ? (
        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
          {(() => {
            const total = points.reduce((sum, p) => sum + p.value, 0) || 1;
            return points.map((p, idx) => {
              const pct = ((p.value / total) * 100).toFixed(1);
              return (
                <div key={idx} className="flex items-center justify-between text-xs text-gray-300 font-display">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `hsl(${(idx * 137.5) % 360}, 75%, 60%)` }}></span>
                    <span className="truncate max-w-[120px]">{p.label}</span>
                  </div>
                  <span className="font-mono text-gray-400">{p.value} ({pct}%)</span>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
          {points.map((p, idx) => {
            const pct = Math.min((p.value / maxValue) * 100, 100);
            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs text-gray-300 font-display">
                  <span className="truncate max-w-[150px]">{p.label}</span>
                  <span className="font-mono text-ipl-gold">{p.value}</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-ipl-gold to-amber-500 rounded-full transition-all duration-500" 
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RechartsViewer({ data, config }: { data: any[]; config: any }) {
  if (!config || !data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No chart data available.
      </div>
    );
  }

  const chartType = config.chart_type || config.type || 'none';
  const xKey = config.x_key || config.xAxis;
  const yKey = config.y_key || config.yAxis;

  if (chartType === 'none' || !xKey || !yKey) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 font-display uppercase tracking-widest text-xs">
        No chart type recommended for this data.
      </div>
    );
  }

  const chartData = data.map(item => ({
    ...item,
    [xKey]: String(item[xKey] || ''),
    [yKey]: Number(item[yKey]) || 0
  }));

  const COLORS = ['#F5C043', '#1F51FF', '#00E676', '#FF3D00', '#D500F9', '#FFD600', '#00E5FF'];

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col justify-between p-4 bg-slate-950 rounded-2xl border border-white/10 backdrop-blur-md">
      <div className="flex-1 w-full h-[320px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
              />
              <Bar dataKey={yKey} fill="#F5C043" radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
              />
              <Line type="monotone" dataKey={yKey} stroke="#F5C043" strokeWidth={3} activeDot={{ r: 6 }} />
            </LineChart>
          ) : chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name?: string; percent?: number }) => `${(name || '').substring(0, 10)}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={yKey}
                nameKey={xKey}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
              />
            </PieChart>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Unsupported chart type.
            </div>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MarkdownRenderer({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const renderInline = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentIdx = 0;
    const regex = /(\*\*|__)(.*?)\1|(`)(.*?)\3/g;
    let match;

    while ((match = regex.exec(str)) !== null) {
      const matchIdx = match.index;
      if (matchIdx > currentIdx) {
        parts.push(str.substring(currentIdx, matchIdx));
      }
      if (match[1]) {
        parts.push(<strong key={matchIdx} className="font-bold text-white">{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<code key={matchIdx} className="font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded border border-white/5 text-emerald-400">{match[4]}</code>);
      }
      currentIdx = regex.lastIndex;
    }

    if (currentIdx < str.length) {
      parts.push(str.substring(currentIdx));
    }

    return parts.length > 0 ? parts : [str];
  };

  const flushList = (key: string | number) => {
    if (!currentList) return null;
    const listType = currentList.type;
    const items = currentList.items;
    currentList = null;

    if (listType === 'ul') {
      return (
        <ul key={key} className="list-disc pl-5 my-2 space-y-1 text-gray-200">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    } else {
      return (
        <ol key={key} className="list-decimal pl-5 my-2 space-y-1 text-gray-200">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ulMatch = line.match(/^(\s*)[-*•]\s+(.*)/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);

    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        if (currentList) {
          elements.push(flushList(`list-${i}`));
        }
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[2]);
      continue;
    }

    if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        if (currentList) {
          elements.push(flushList(`list-${i}`));
        }
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[2]);
      continue;
    }

    if (currentList) {
      elements.push(flushList(`list-${i}`));
    }

    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      const headerClasses = 
        level === 1 ? "text-xl font-bold text-white mt-4 mb-2 font-display" :
        level === 2 ? "text-lg font-bold text-white mt-3 mb-2 font-display" :
        "text-base font-bold text-white mt-2 mb-1 font-display";
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      elements.push(
        <Tag key={i} className={headerClasses}>
          {renderInline(content)}
        </Tag>
      );
      continue;
    }

    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    elements.push(
      <p key={i} className="mb-2 leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  if (currentList) {
    elements.push(flushList('list-end'));
  }

  return <div className="space-y-1">{elements}</div>;
}

export function AdminSQLAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | 'new'>('new');
  const [messages, setMessages] = useState<SQLMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showRawMap, setShowRawMap] = useState<Record<string, boolean>>({});
  const [activeChatTab, setActiveChatTab] = useState<'chat' | 'chart'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeChatTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, loading, activeChatTab]);

  const latestChartMessage = useMemo(() => {
    return [...messages]
      .reverse()
      .find(m => m.sender === 'assistant' && m.chart_config && m.chart_config.chart_type && m.chart_config.chart_type !== 'none' && m.results && m.results.length > 0);
  }, [messages]);

  useEffect(() => {
    if (!latestChartMessage) {
      setActiveChatTab('chat');
    }
  }, [latestChartMessage]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await apiClient.get('/admin/sql-assistant/sessions');
      setSessions(res.data);
    } catch (err) {
      console.error('Failed to load chat sessions', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const loadSession = async (sessionId: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/admin/sql-assistant/sessions/${sessionId}`);
      const mapped = res.data.map((msg: any) => ({
        id: msg.id.toString(),
        sender: msg.role === 'user' ? 'user' : 'assistant',
        text: msg.content,
        sql: msg.sql_query,
        results: msg.query_results,
        chart_config: msg.chart_config,
      }));
      setMessages(mapped);
      setActiveSessionId(sessionId);
      // Auto-close sidebar on mobile once a session is loaded to maximize space
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    } catch (err) {
      toast.error('Failed to load session messages');
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    setActiveSessionId('new');
    setMessages([]);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleDeleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat session?')) return;
    try {
      await apiClient.delete(`/admin/sql-assistant/sessions/${sessionId}`);
      toast.success('Session deleted');
      if (activeSessionId === sessionId) {
        handleNewSession();
      }
      fetchSessions();
    } catch (err) {
      toast.error('Failed to delete session');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuery = input.trim();
    const tempUserMsgId = Math.random().toString();
    
    setMessages(prev => [
      ...prev,
      {
        id: tempUserMsgId,
        sender: 'user',
        text: userQuery,
      }
    ]);
    setInput('');
    setLoading(true);

    try {
      const response = await apiClient.post(`/admin/sql-assistant/sessions/${activeSessionId}/chat`, { query: userQuery });
      const msg = response.data;
      
      if (activeSessionId === 'new') {
        setActiveSessionId(msg.session_id);
        fetchSessions();
      }

      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsgId),
        {
          id: Math.random().toString(),
          sender: 'user',
          text: userQuery,
        },
        {
          id: msg.id.toString(),
          sender: 'assistant',
          text: msg.content || 'Query executed.',
          sql: msg.sql_query,
          results: msg.query_results,
          chart_config: msg.chart_config,
        }
      ]);
      if (msg.chart_config && msg.chart_config.chart_type && msg.chart_config.chart_type !== 'none' && msg.query_results && msg.query_results.length > 0) {
        setActiveChatTab('chart');
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: 'Error contacting SQL assistant.',
          error: err.response?.data?.detail || err.message || 'Unknown error',
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleRaw = (id: string) => {
    setShowRawMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed bottom-6 right-6 left-6 md:left-auto z-50 flex flex-col items-end pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] select-none pointer-events-none">
      {/* Chat Window Panel */}
      {isOpen && (
        <div className="pointer-events-auto w-full md:w-[720px] h-[580px] max-h-[calc(100vh-140px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex mb-4 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
          
          {/* Sidebar for Sessions */}
          {sidebarOpen && (
            <div className="absolute md:relative left-0 top-[57px] bottom-[69px] md:top-0 md:bottom-0 z-20 w-[200px] md:w-[220px] bg-slate-950 border-r border-white/10 flex flex-col shrink-0">
              <div className="p-3 border-b border-white/10 flex items-center justify-between min-h-[56px]">
                <span className="font-display text-[9px] uppercase tracking-widest text-gray-500 font-bold">Sessions</span>
                <button
                  onClick={handleNewSession}
                  className="p-2 text-ipl-gold hover:text-white rounded-lg active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/5 border border-white/10"
                  title="New Session"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Sessions List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
                {loadingSessions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-xs font-display uppercase tracking-widest">No sessions yet.</div>
                ) : (
                  sessions.map((sess) => (
                    <div
                      key={sess.id}
                      onClick={() => loadSession(sess.id)}
                      className={`group flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 border text-xs select-none min-h-[44px] ${
                        activeSessionId === sess.id
                          ? 'bg-ipl-gold text-ipl-navy font-bold border-ipl-gold shadow-md'
                          : 'bg-white/5 text-gray-400 hover:text-white border-transparent hover:bg-white/10'
                      }`}
                    >
                      <span className="truncate pr-2 font-display uppercase tracking-wider text-[10px]">
                        {sess.title || `Chat #${sess.id}`}
                      </span>
                      <button
                        onClick={(e) => handleDeleteSession(sess.id, e)}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center ${
                          activeSessionId === sess.id
                            ? 'text-ipl-navy hover:bg-ipl-navy/10'
                            : 'text-gray-500 hover:text-red-400 hover:bg-white/5'
                        }`}
                        title="Delete Session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col bg-slate-900/50">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 border-b border-white/10 flex justify-between items-center min-h-[56px]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 text-gray-400 hover:text-white rounded-lg active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/5 border border-white/10"
                  title="Toggle Sidebar"
                >
                  <List className="w-4 h-4" />
                </button>
                <Terminal className="w-4 h-4 text-ipl-gold animate-pulse" />
                <span className="font-display text-[10px] uppercase tracking-widest text-white font-bold">
                  {activeSessionId === 'new' ? 'New AI Assistant' : 'AI SQL Assistant'}
                </span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            {latestChartMessage && (
              <div className="flex border-b border-white/10 bg-slate-950 p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setActiveChatTab('chat')}
                  className={`flex-1 py-2.5 min-h-[44px] flex items-center justify-center text-xs font-display uppercase tracking-wider text-center rounded-xl transition-all ${
                    activeChatTab === 'chat'
                      ? 'bg-ipl-gold text-ipl-navy font-bold shadow-lg shadow-ipl-gold/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Chat History
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChatTab('chart')}
                  className={`flex-1 py-2.5 min-h-[44px] flex items-center justify-center text-xs font-display uppercase tracking-wider text-center rounded-xl transition-all ${
                    activeChatTab === 'chart'
                      ? 'bg-ipl-gold text-ipl-navy font-bold shadow-lg shadow-ipl-gold/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Visualization
                </button>
              </div>
            )}

            {activeChatTab === 'chat' ? (
              <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-4">
                    <Terminal className="w-12 h-12 text-ipl-gold/45 mb-3" />
                    <p className="text-sm font-semibold text-white uppercase tracking-wider font-display text-ipl-gold">Query Database with AI</p>
                    <p className="text-xs text-gray-400 mt-2 max-w-[280px]">
                      Ask questions in plain English, and the assistant will generate and execute SQL.
                    </p>
                    <p className="text-[10px] text-ipl-gold/70 mt-4 font-mono bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                      Example: "show top 5 users by points"
                    </p>
                  </div>
                )}
                
                {messages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div 
                      className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm ${
                        msg.sender === 'user' 
                          ? 'bg-ipl-gold text-ipl-navy font-bold rounded-br-none shadow-md shadow-ipl-gold/10 font-display' 
                          : 'bg-white/5 text-gray-200 border border-white/10 rounded-bl-none'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                      ) : (
                        <div className="select-text">
                          <MarkdownRenderer text={msg.text} />
                        </div>
                      )}
                      
                      {msg.sql && (
                        <div className="mt-3 bg-black/60 p-2.5 rounded-lg border border-white/10 font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre select-text">
                          <div className="flex justify-between items-center text-[9px] text-gray-500 mb-1 font-sans font-bold tracking-widest">
                            <span>GENERATED SQL</span>
                          </div>
                          {msg.sql}
                        </div>
                      )}

                      {msg.error && (
                        <div className="mt-2 bg-red-950/60 p-2.5 rounded-lg border border-red-500/20 text-red-400 font-mono text-[11px] select-text">
                          <div className="text-[9px] text-red-500 font-sans font-bold mb-1 tracking-widest">DATABASE ERROR</div>
                          {msg.error}
                        </div>
                      )}

                      {msg.chart_config && msg.results && msg.results.length > 0 && (
                        <QuickChart data={msg.results} config={msg.chart_config} />
                      )}

                      {msg.results && msg.results.length > 0 && (
                        <div className="mt-3 border-t border-white/5 pt-2">
                          <button
                            type="button"
                            onClick={() => toggleRaw(msg.id)}
                            className="flex items-center gap-1 text-[11px] text-ipl-gold hover:text-white transition-colors min-h-[36px]"
                          >
                            {showRawMap[msg.id] ? 'Hide' : 'Show'} Raw Data ({msg.results.length} rows)
                            {showRawMap[msg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          
                          {showRawMap[msg.id] && (
                            <pre className="mt-2 bg-black/60 p-2 rounded-lg border border-white/10 font-mono text-[10px] text-gray-300 max-h-[150px] overflow-auto whitespace-pre-wrap select-text">
                              {JSON.stringify(msg.results, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}

                      {msg.results && msg.results.length === 0 && !msg.error && msg.sender === 'assistant' && (
                        <p className="text-[11px] text-gray-400 italic mt-2">No matching records found.</p>
                      )}
                    </div>
                  </div>
                ))}
                
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-none px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-ipl-gold" />
                      <span>Thinking & querying DB...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex-1 p-4 overflow-y-auto flex flex-col">
                <div className="mb-3 px-2 py-1.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                  <span className="text-[10px] font-display text-gray-400 uppercase tracking-widest font-bold">Active Visualization</span>
                  <span className="text-[10px] font-mono text-ipl-gold uppercase tracking-wider bg-ipl-gold/10 px-2 py-0.5 rounded-full border border-ipl-gold/20">
                    {latestChartMessage?.chart_config?.chart_type} Chart
                  </span>
                </div>
                <div className="flex-1 min-h-[300px]">
                  <RechartsViewer data={latestChartMessage?.results || []} config={latestChartMessage?.chart_config} />
                </div>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-white/10 flex gap-2 min-h-[68px]">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the database..."
                disabled={loading}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-ipl-gold/50 text-[17px] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="bg-ipl-gold text-ipl-navy hover:bg-white hover:text-ipl-navy transition-all rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:hover:bg-ipl-gold disabled:hover:text-ipl-navy"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto w-12 h-12 bg-ipl-gold hover:bg-white text-ipl-navy rounded-full shadow-lg shadow-ipl-gold/25 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 min-w-[44px] min-h-[44px]"
        title="AI SQL Assistant"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
    </div>
  );
}

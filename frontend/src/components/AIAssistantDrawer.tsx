import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  ShieldAlert,
  Fuel,
  Wind,
  Compass,
  FileText,
  Activity,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { AIChatMessage } from '../types';
import { sendAIChatMessage } from '../services/aiApi';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contextData: Record<string, any>;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  contextData,
}) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'init_1',
      sender: 'assistant',
      text: 'AERO-GUARD Tactical AI Co-Pilot online. Grounded in live Open-Meteo meteorological telemetry, OpenSky airspace feeds, and DRDO 24-hour transient ODE thermodynamic simulation.\n\nHow can I assist your mission analysis today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'AERO-GUARD Core',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const prompt = textToSend || inputText;
    if (!prompt.trim() || loading) return;

    const userMsg: AIChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: prompt.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const resp = await sendAIChatMessage(prompt.trim(), contextData);
      const botMsg: AIChatMessage = {
        id: `b_${Date.now()}`,
        sender: 'assistant',
        text: resp.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: resp.source,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: AIChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ Analysis request encountered an error: ${err.message || 'Service unavailable'}. Please verify backend status.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'Error Handler',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    { label: 'Thermal Anomalies', prompt: 'Analyze any thermal anomalies, infiltration spikes, or freeze risks.', icon: ShieldAlert },
    { label: 'Fuel Logistics', prompt: 'Summarize fuel savings, daily consumption in liters, and convoy burden.', icon: Fuel },
    { label: 'Weather Impact', prompt: 'Evaluate current weather conditions and wind gust impact on shelter comfort.', icon: Wind },
    { label: 'Executive Brief', prompt: 'Generate an executive engineering mission brief for current deployment.', icon: FileText },
  ];

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 flex flex-col bg-[#0b1329] border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/80 backdrop-blur-xl ${
        isExpanded ? 'w-[750px] h-[650px]' : 'w-[420px] h-[520px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/70 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-950 flex items-center justify-center border border-cyan-500/50 text-cyan-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 font-mono tracking-wide">
              AERO-GUARD Tactical AI Co-Pilot
            </h3>
            <span className="text-[10px] text-cyan-400/90 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              Live Simulation Grounded
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors"
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
            title="Close Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Prompt Chips */}
      <div className="px-3 py-2 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto bg-slate-900/40">
        {quickPrompts.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q.prompt)}
            disabled={loading}
            className="whitespace-nowrap px-2 py-1 rounded-md bg-slate-950 border border-slate-800 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 text-[10px] font-mono flex items-center gap-1 transition-all"
          >
            <q.icon className="w-3 h-3 text-cyan-400" />
            <span>{q.label}</span>
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 p-3.5 overflow-y-auto space-y-3 font-sans text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'assistant' && (
              <div className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-xl px-3 py-2.5 leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-900/90 border border-slate-800 text-slate-200'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
              <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-slate-700/40 text-[9px] text-slate-400 font-mono">
                <span>{m.timestamp}</span>
                {m.source && <span className="text-cyan-400/80 truncate max-w-[190px]">{m.source}</span>}
              </div>
            </div>

            {m.sender === 'user' && (
              <div className="w-6 h-6 rounded-md bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-300 flex-shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <Bot className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-slate-900/90 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-mono flex items-center gap-2">
              <span className="animate-pulse">Synthesizing telemetry & thermodynamic models</span>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-950/70 rounded-b-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask AI co-pilot about anomalies, fuel, weather..."
            disabled={loading}
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold transition-all flex items-center justify-center shadow-lg shadow-cyan-500/20"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, Bot, User, CalendarPlus } from 'lucide-react';
import { generateScheduleAdvice } from '../services/geminiService';
import { CalendarEvent, ChatMessage } from '../types';
import { generateId } from '../utils';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  currentDate: Date;
  onAddEvent: (event: CalendarEvent) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  isOpen,
  onClose,
  events,
  currentDate,
  onAddEvent,
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'こんにちは！AIアシスタントのOptiPlanです。スケジュールの調整や、空き時間の有効活用についてお手伝いします。「今のスケジュールで1時間勉強できる時間は？」のように聞いてみてください。',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: input,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const chatSession = await generateScheduleAdvice(input, events, currentDate);
      
      // Send message to Gemini
      const response = await chatSession.sendMessage({ message: userMsg.text });
      
      // Handle Function Calls (Tools)
      const functionCalls = response.functionCalls;
      let toolResponseText = "";

      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          if (call.name === 'add_calendar_event') {
            const args = call.args as any;
            
            const newEvent: CalendarEvent = {
              id: generateId(),
              title: args.title,
              start: new Date(args.startIso),
              end: new Date(args.endIso),
              description: args.description || 'AI Suggested',
              type: (args.type as any) || 'ai-suggested',
              color: 'bg-amber-100 text-amber-700 border-amber-200', // Default AI color
            };

            onAddEvent(newEvent);
            toolResponseText = `\n\n✨ 予定「${newEvent.title}」を ${new Date(newEvent.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} に追加しました。`;
            
            // Note: In a real persistent chat loop, we would send the tool response back to the model.
            // For this UI-focused demo, we just acknowledge the action in the UI.
          }
        }
      }

      const modelText = response.text || "承知いたしました。";
      
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'model',
          text: modelText + toolResponseText,
        },
      ]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'model',
          text: 'すみません、エラーが発生しました。もう一度お試しください。',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl border-l border-gray-200 transform transition-transform duration-300 z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5" />
          <h2 className="font-semibold text-lg">AI Assistant</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-indigo-500 rounded-full transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3 shadow-sm text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1 opacity-80 text-xs">
                {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                <span>{msg.role === 'user' ? 'あなた' : 'OptiPlan AI'}</span>
              </div>
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none p-3 shadow-sm flex items-center space-x-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="「明日の午後に会議を入れたい」「来週の空き時間は？」"
            className="w-full pl-4 pr-12 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
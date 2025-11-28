import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, CalendarDays, Plus, MessageSquarePlus, RefreshCw, CheckCircle2, Settings } from 'lucide-react';
import { MonthView } from './components/MonthView';
import { DayView } from './components/DayView';
import { AIAssistant } from './components/AIAssistant';
import { GoogleConnectModal } from './components/GoogleConnectModal';
import { AddEventModal } from './components/AddEventModal';
import { CalendarEvent, ViewMode } from './types';
import { generateId, formatDate } from './utils';
import { initializeGoogleCalendar, handleAuthClick } from './services/googleCalendarService';

// Mock Data Generation
const generateMockEvents = (): CalendarEvent[] => {
  const now = new Date();
  const events: CalendarEvent[] = [];
  
  // Work Events
  events.push({
    id: generateId(),
    title: '週次ミーティング',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0),
    type: 'work',
    color: 'blue',
    source: 'local'
  });

  events.push({
    id: generateId(),
    title: 'プロジェクトA レビュー',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30),
    type: 'work',
    color: 'blue',
    source: 'local'
  });

  // Personal Events
  events.push({
    id: generateId(),
    title: 'ジム',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 18, 0),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 19, 30),
    type: 'personal',
    color: 'green',
    source: 'local'
  });

  events.push({
    id: generateId(),
    title: 'ランチ（田中さん）',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 12, 0),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 13, 0),
    type: 'personal',
    color: 'green',
    source: 'local'
  });

  return events;
};

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  
  // Google Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Initialize with mock data and setup Google Calendar
  useEffect(() => {
    setEvents(generateMockEvents());
    
    // Attempt to initialize Google API
    initializeGoogleCalendar(() => {}, () => {});
  }, []);

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Triggered when sidebar button is clicked
  const handleSyncClick = () => {
    if (isGoogleConnected) {
      // If already connected, maybe just re-sync? 
      // For now, let's treat it as a re-sync action
      handleGoogleAuthAndSync();
    } else {
      // Open login modal
      setIsLoginModalOpen(true);
    }
  };

  // Logic executed from the Modal
  const handleGoogleAuthAndSync = async () => {
    setIsSyncing(true);
    try {
      const googleEvents = await handleAuthClick();
      
      // Merge events: Filter out old google events if any, then add new ones
      setEvents(prev => {
        const localEvents = prev.filter(e => e.source !== 'google');
        return [...localEvents, ...googleEvents];
      });
      
      setIsGoogleConnected(true);
      setIsLoginModalOpen(false); // Close modal on success
    } catch (error) {
      console.error("Sync failed", error);
      alert("カレンダーの同期に失敗しました。");
    } finally {
      setIsSyncing(false);
    }
  };

  const addEvent = (event: CalendarEvent) => {
    setEvents(prev => [...prev, { ...event, source: 'local' }]);
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800 overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 space-y-8 z-20 shadow-sm hidden sm:flex">
        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
          <CalendarDays size={28} />
        </div>
        
        <nav className="flex flex-col space-y-4 w-full items-center">
          <button 
            onClick={() => setViewMode('day')}
            className={`p-3 rounded-xl transition-all ${viewMode === 'day' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
            title="日表示"
          >
            <Calendar size={24} />
          </button>
           <button 
            onClick={() => setViewMode('month')}
            className={`p-3 rounded-xl transition-all ${viewMode === 'month' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
             title="月表示"
          >
            <CalendarDays size={24} />
          </button>
        </nav>

        <div className="mt-auto space-y-4 flex flex-col items-center w-full">
           <button 
            onClick={handleSyncClick}
            className={`p-3 rounded-xl transition-all relative group ${isGoogleConnected ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
            title={isGoogleConnected ? "同期完了" : "Googleカレンダーと同期"}
            disabled={isSyncing && !isLoginModalOpen}
          >
            {isSyncing && !isLoginModalOpen ? (
              <RefreshCw size={24} className="animate-spin text-blue-600" />
            ) : isGoogleConnected ? (
              <CheckCircle2 size={24} />
            ) : (
              <RefreshCw size={24} />
            )}
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 transition pointer-events-none">
              {isGoogleConnected ? "同期済み" : "Google連携"}
            </span>
          </button>
           <button 
            onClick={() => setIsAIOpen(!isAIOpen)}
            className={`p-3 rounded-xl transition-all relative ${isAIOpen ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
            title="AIアシスタント"
          >
            <MessageSquarePlus size={24} />
            {!isAIOpen && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {viewMode === 'month' 
                ? new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(currentDate)
                : formatDate(currentDate)
              }
            </h1>
            <div className="flex items-center bg-gray-100 rounded-lg p-1 space-x-1">
              <button onClick={handlePrev} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition"><ChevronLeft size={18} /></button>
              <button onClick={handleToday} className="px-3 py-1 text-xs font-semibold hover:bg-white hover:shadow-sm rounded-md transition">今日</button>
              <button onClick={handleNext} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition"><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button 
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-indigo-200"
              onClick={() => {
                setIsAddEventModalOpen(true);
              }}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">予定を追加</span>
            </button>
            
            {/* Mobile Menu Button */}
            <button 
              className="sm:hidden p-2 text-gray-500"
              onClick={() => setIsAIOpen(!isAIOpen)}
            >
              <MessageSquarePlus />
            </button>
          </div>
        </header>

        {/* View Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-hidden relative">
          {viewMode === 'month' ? (
            <MonthView 
              currentDate={currentDate} 
              events={events} 
              onSelectDate={(date) => {
                setCurrentDate(date);
                setViewMode('day');
              }}
            />
          ) : (
            <DayView currentDate={currentDate} events={events} />
          )}
        </div>

        {/* AI Assistant Overlay/Sidebar */}
        <AIAssistant 
          isOpen={isAIOpen} 
          onClose={() => setIsAIOpen(false)} 
          events={events}
          currentDate={currentDate}
          onAddEvent={addEvent}
        />

        {/* Google Login Modal */}
        <GoogleConnectModal 
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onConnect={handleGoogleAuthAndSync}
          isLoading={isSyncing}
        />

        {/* Add Event Modal */}
        <AddEventModal
          isOpen={isAddEventModalOpen}
          onClose={() => setIsAddEventModalOpen(false)}
          onAdd={addEvent}
          initialDate={currentDate}
        />
      </main>
    </div>
  );
};

export default App;

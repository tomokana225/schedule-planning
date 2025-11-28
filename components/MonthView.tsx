import React from 'react';
import { CalendarEvent } from '../types';
import { getDaysInMonth, isSameDay, EVENT_COLORS } from '../utils';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectDate: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({ currentDate, events, onSelectDate }) => {
  const days = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDayOfWeek = days[0].getDay(); // 0 (Sun) - 6 (Sat)
  
  // Pad the beginning
  const emptyDays = Array.from({ length: firstDayOfWeek });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
          <div key={day} className={`p-3 text-center text-xs font-semibold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} className="bg-gray-50/30 border-b border-r border-gray-100"></div>
        ))}
        
        {days.map((day) => {
          const dayEvents = events.filter(e => isSameDay(e.start, day));
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, currentDate);

          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={`min-h-[100px] p-2 border-b border-r border-gray-100 cursor-pointer hover:bg-indigo-50/50 transition-colors relative flex flex-col ${isSelected ? 'bg-indigo-50' : ''}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span 
                  className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full 
                    ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}
                  `}
                >
                  {day.getDate()}
                </span>
              </div>
              
              <div className="space-y-1 flex-1 overflow-y-auto max-h-[100px] no-scrollbar">
                {dayEvents.slice(0, 4).map(event => (
                  <div 
                    key={event.id} 
                    className={`text-[10px] px-1.5 py-0.5 rounded truncate ${EVENT_COLORS[event.type].split(' ')[0]} ${EVENT_COLORS[event.type].split(' ')[1]}`}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 4 && (
                  <div className="text-[10px] text-gray-400 pl-1">+ 他 {dayEvents.length - 4} 件</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
import React, { useEffect, useRef } from 'react';
import { CalendarEvent } from '../types';
import { EVENT_COLORS, isSameDay } from '../utils';

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
}

export const DayView: React.FC<DayViewProps> = ({ currentDate, events }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayEvents = events.filter((e) => isSameDay(e.start, currentDate));

  // Scroll to 8 AM by default on mount
  useEffect(() => {
    if (containerRef.current) {
      const eightAM = containerRef.current.querySelector('[data-hour="8"]');
      if (eightAM) {
        eightAM.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  }, [currentDate]);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden rounded-xl border border-gray-200 shadow-sm relative">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
        <div>
           <h3 className="text-xl font-bold text-gray-800">
            {currentDate.getDate()}日 <span className="text-gray-500 text-base font-normal">{new Intl.DateTimeFormat('ja-JP', { weekday: 'long' }).format(currentDate)}</span>
          </h3>
          <p className="text-xs text-gray-500">{dayEvents.length} 件の予定</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative" ref={containerRef}>
        {/* Grid Lines */}
        {hours.map((hour) => (
          <div
            key={hour}
            data-hour={hour}
            className="flex border-b border-gray-100 h-20 group hover:bg-gray-50 transition-colors"
          >
            <div className="w-16 flex-shrink-0 text-right pr-3 pt-2 text-xs text-gray-400 group-hover:text-gray-600 font-medium">
              {hour.toString().padStart(2, '0')}:00
            </div>
            <div className="flex-1 relative border-l border-gray-100"></div>
          </div>
        ))}

        {/* Current Time Indicator */}
        {isSameDay(new Date(), currentDate) && (
          <div 
            className="absolute left-16 right-0 border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
            style={{
              top: `${(new Date().getHours() * 60 + new Date().getMinutes()) * (80 / 60)}px`
            }}
          >
             <div className="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
          </div>
        )}

        {/* Events */}
        {dayEvents.map((event) => {
          // Calculate position
          const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
          const durationMinutes = (event.end.getTime() - event.start.getTime()) / (1000 * 60);
          const top = (startMinutes * 80) / 60; // 80px per hour
          const height = (durationMinutes * 80) / 60;

          const colorClass = EVENT_COLORS[event.type] || 'bg-gray-100 text-gray-700 border-gray-200';

          return (
            <div
              key={event.id}
              className={`absolute left-16 right-4 rounded-lg px-3 py-2 text-xs border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer z-10 overflow-hidden ${colorClass}`}
              style={{
                top: `${top}px`,
                height: `${Math.max(height, 20)}px`, // Min height for visibility
              }}
            >
              <div className="font-semibold truncate text-sm">{event.title}</div>
              <div className="opacity-90 truncate">
                {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                {event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              {event.description && <div className="mt-1 opacity-75 truncate">{event.description}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
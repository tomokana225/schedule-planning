export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  type: 'work' | 'personal' | 'ai-suggested' | 'meeting' | 'google-calendar';
  color: string;
  source?: 'local' | 'google';
  location?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}

export type ViewMode = 'month' | 'day';

export interface CalendarState {
  currentDate: Date;
  viewMode: ViewMode;
  events: CalendarEvent[];
}
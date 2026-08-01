import { ChatMessage } from '../types';

export interface TimetableAIContext {
  schoolName: string;
  days: string[];
  periodsPerDay: number;
  classes: { name: string }[];
  teachers: { name: string; unavailableCount: number }[];
  subjects: { name: string }[];
  unplaced: { subjectName: string; classNames: string; teacherNames: string; remaining: number }[];
  totalLessons: number;
  totalPlacements: number;
}

export const sendMessageToAI = async (
  message: string,
  history: ChatMessage[],
  context: TimetableAIContext,
) => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.map(h => ({ role: h.role, text: h.text })),
      context,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    throw new Error(err.error || 'Server error');
  }

  return response.json() as Promise<{ text: string }>;
};

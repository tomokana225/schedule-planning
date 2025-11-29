import { CalendarEvent } from "../types";

// Note: We no longer import GoogleGenAI here because the logic has moved to the server (src/worker.ts).
// This reduces bundle size and keeps secrets safe.

export const sendMessageToAI = async (
  message: string,
  history: any[],
  currentEvents: CalendarEvent[],
  currentDate: Date
) => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
        currentEvents,
        currentDate: currentDate.toISOString(),
      }),
    });

    if (!response.ok) {
      const err = await response.json() as any;
      throw new Error(err.error || 'Server error');
    }

    const data = await response.json();
    return data; // Returns { text, functionCalls }
  } catch (error) {
    console.error("Failed to communicate with AI endpoint:", error);
    throw error;
  }
};
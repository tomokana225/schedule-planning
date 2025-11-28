import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { CalendarEvent } from "../types";

// Lazy initialization to prevent top-level crashes
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("API Key is missing");
      throw new Error("API Key is not configured");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

// Define the tool for the AI to propose schedule changes
const addEventTool: FunctionDeclaration = {
  name: 'add_calendar_event',
  description: 'Add a new event to the calendar. Use this when the user accepts a suggestion or asks to schedule something.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Title of the event',
      },
      startIso: {
        type: Type.STRING,
        description: 'Start time in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)',
      },
      endIso: {
        type: Type.STRING,
        description: 'End time in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)',
      },
      description: {
        type: Type.STRING,
        description: 'Description or reason for this slot',
      },
      type: {
        type: Type.STRING,
        description: 'Type of event: "work", "personal", "meeting"',
      }
    },
    required: ['title', 'startIso', 'endIso'],
  },
};

const tools: Tool[] = [{ functionDeclarations: [addEventTool] }];

export const generateScheduleAdvice = async (
  prompt: string,
  currentEvents: CalendarEvent[],
  currentDate: Date
) => {
  const client = getAiClient();
  
  // Create a simplified context of the current schedule for the AI
  const scheduleContext = currentEvents.map(e => ({
    title: e.title,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    type: e.type
  }));

  const systemInstruction = `
    You are an expert AI Scheduler Assistant named "OptiPlan".
    
    Your goal is to help the user manage their time efficiently.
    Current Context:
    - Today is: ${currentDate.toISOString()}
    - User's existing schedule: ${JSON.stringify(scheduleContext)}

    Capabilities:
    1. Analyze gaps in the schedule.
    2. Suggest optimal times for new tasks based on duration and context (e.g., don't schedule deep work during lunch).
    3. If the user asks to schedule something, find the best slot and use the 'add_calendar_event' tool.
    4. Be polite, concise, and helpful. Japanese language is preferred if the user speaks Japanese.

    When suggesting a time, explain WHY you chose that slot before calling the tool.
  `;

  const chat = client.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
      tools,
      temperature: 0.7,
    }
  });

  return chat;
};
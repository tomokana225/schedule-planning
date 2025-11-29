import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";

// Cloudflare Worker Env Interface
interface Env {
  API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_API_KEY: string;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

// Tool Definition (Same as frontend, moved to backend)
const addEventTool: FunctionDeclaration = {
  name: 'add_calendar_event',
  description: 'Add a new event to the calendar. Use this when the user accepts a suggestion or asks to schedule something.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Title of the event' },
      startIso: { type: Type.STRING, description: 'Start time in ISO 8601 format' },
      endIso: { type: Type.STRING, description: 'End time in ISO 8601 format' },
      description: { type: Type.STRING, description: 'Description' },
      type: { type: Type.STRING, description: 'Type of event: "work", "personal", "meeting"' }
    },
    required: ['title', 'startIso', 'endIso'],
  },
};

const tools: Tool[] = [{ functionDeclarations: [addEventTool] }];

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // ============================================================
    // API: Config (Get Public Keys)
    // ============================================================
    if (url.pathname === '/api/config') {
      return new Response(JSON.stringify({
        googleClientId: env.GOOGLE_CLIENT_ID || '',
        googleApiKey: env.GOOGLE_API_KEY || ''
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // API: Chat with Gemini
    // ============================================================
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { message, history, currentEvents, currentDate } = body;

        if (!env.API_KEY) {
          return new Response(JSON.stringify({ error: "API Key not configured on server" }), { status: 500 });
        }

        const client = new GoogleGenAI({ apiKey: env.API_KEY });
        
        // Context setup
        const scheduleContext = currentEvents.map((e: any) => ({
          title: e.title,
          start: e.start,
          end: e.end,
          type: e.type
        }));

        const systemInstruction = `
          You are an expert AI Scheduler Assistant named "OptiPlan".
          Current Context:
          - Today is: ${currentDate}
          - User's existing schedule: ${JSON.stringify(scheduleContext)}
          
          Capabilities:
          1. Analyze gaps in the schedule.
          2. Suggest optimal times.
          3. Use 'add_calendar_event' tool if requested.
          4. Be polite and concise.
        `;

        // Reconstructing minimal history for context if provided
        let contents = [];
        if (history && Array.isArray(history)) {
           // Simplify history for the API call
           contents = history.map((h: any) => ({
             role: h.role,
             parts: [{ text: h.text }]
           }));
        }
        // Add current user message
        contents.push({ role: 'user', parts: [{ text: message }] });

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents as any,
            config: {
                systemInstruction,
                tools,
                temperature: 0.7
            }
        });

        const functionCalls = response.functionCalls;
        const text = response.text;

        return new Response(JSON.stringify({
          text,
          functionCalls: functionCalls ? functionCalls.map(fc => ({
             name: fc.name,
             args: fc.args
          })) : []
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        console.error("Gemini API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }

    // ============================================================
    // Static Assets (Fallback)
    // ============================================================
    // If using Workers Assets, env.ASSETS.fetch handles static files
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    
    return new Response("Not Found", { status: 404 });
  },
};
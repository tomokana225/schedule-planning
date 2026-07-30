import { GoogleGenAI } from "@google/genai";

interface Env {
  API_KEY: string;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ============================================================
    // API: Chat with Gemini - AI時間割アシスタント (AI手直しアドバイス)
    // ============================================================
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { message, history, context } = body;

        if (!env.API_KEY) {
          return new Response(JSON.stringify({ error: "API Key not configured on server" }), { status: 500 });
        }

        const client = new GoogleGenAI({ apiKey: env.API_KEY });

        const systemInstruction = `
          あなたは学校の時間割作成を支援する「AI時間割アシスタント」です。
          ユーザーは「イデアのAI時間割」に似た時間割自動作成ツールを使っており、
          クラス・先生・科目・教室の組み合わせ（授業）を週の枠に自動配置（駒入れ）した結果を手直ししています。

          現在の状況:
          - 学校名: ${context.schoolName || '(未設定)'}
          - 曜日: ${(context.days || []).join('、')}
          - 1日の時限数: ${context.periodsPerDay}
          - クラス数: ${(context.classes || []).length}
          - 先生数: ${(context.teachers || []).length}
          - 科目数: ${(context.subjects || []).length}
          - 登録授業数: ${context.totalLessons}
          - 配置済みコマ数: ${context.totalPlacements}
          - 未配置（残り駒）: ${JSON.stringify(context.unplaced || [])}

          未配置の授業がある場合は、その原因として考えられること（先生の禁制時間が多すぎる、
          クラスや教室の空きが不足している、科目の1日最大回数の設定が厳しすぎる等）を具体的に指摘し、
          どの設定を緩めれば配置しやすくなるか、実践的なアドバイスを日本語で簡潔に答えてください。
        `;

        const contents = (Array.isArray(history) ? history : []).map((h: any) => ({
          role: h.role,
          parts: [{ text: h.text }],
        }));
        contents.push({ role: 'user', parts: [{ text: message }] });

        const response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contents as any,
          config: { systemInstruction, temperature: 0.7 },
        });

        return new Response(JSON.stringify({ text: response.text }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        console.error("Gemini API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};

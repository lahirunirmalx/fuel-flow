/**
 * Netlify serverless function. Keeps GEMINI_API_KEY server-side only.
 * Set GEMINI_API_KEY in Netlify UI (Site → Environment variables), scope: Functions.
 */
import { GoogleGenAI } from "@google/genai";

const PROMPT =
  "Generate a short, depressive, and cynical 'fact' explaining why fuel rationing (like parity-based pumping) is necessary. Blame current and previous governments, uneducated fuel hoarders, and literally everyone except the user. Use a dark, pessimistic tone. Keep it under 3 sentences.";

const FALLBACK =
  "The AI is too depressed to answer. Probably because of the government.";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async () => {
  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ text: FALLBACK }, 503);
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: PROMPT,
    });
    const text =
      response.text ||
      "The system is broken, and it's not your fault. It's everyone else's.";
    return jsonResponse({ text });
  } catch {
    return jsonResponse({ text: FALLBACK }, 500);
  }
};

// Served at /.netlify/functions/generate-fact; netlify.toml rewrites /api/generate-fact here

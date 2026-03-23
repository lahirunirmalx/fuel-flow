/**
 * GET /.netlify/functions/generate-fact — Gemini “fact” copy; key stays server-side.
 * Set GEMINI_API_KEY in Netlify UI (Site → Environment variables), scope: Functions.
 */
import { GoogleGenAI } from "@google/genai";
import { envInt } from "./lib/env.mjs";
import { getClientKey, checkRateLimit } from "./lib/rateLimit.mjs";
import { truncateString } from "./lib/truncate.mjs";

const PROMPT =
  "Generate a short, depressive, and cynical 'fact' explaining why fuel rationing (like parity-based pumping) is necessary. Blame current and previous governments, uneducated fuel hoarders, and literally everyone except the user. Use a dark, pessimistic tone. Keep it under 3 sentences.";

const FALLBACK =
  "The AI is too depressed to answer. Probably because of the government.";

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export default async (req) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const rl = checkRateLimit(
    `${getClientKey(req)}:generate-fact`,
    "RATE_LIMIT_GENERATE_FACT_MAX",
    30
  );
  if (!rl.ok) {
    return jsonResponse(
      { error: "Too many requests" },
      429,
      { "Retry-After": String(rl.retryAfterSec) }
    );
  }

  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ text: FALLBACK }, 503);
  }
  const maxChars = envInt("GENERATE_FACT_MAX_CHARS", 4000);
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: PROMPT,
    });
    const raw =
      response.text ||
      "The system is broken, and it's not your fault. It's everyone else's.";
    const text = truncateString(raw, maxChars);
    return jsonResponse({ text });
  } catch {
    return jsonResponse({ text: FALLBACK }, 500);
  }
};

// Served at /.netlify/functions/generate-fact; netlify.toml rewrites /api/generate-fact here

/**
 * POST /.netlify/functions/fuel-prices — Gemini + optional Google Search for Sri Lanka fuel prices.
 */
import { GoogleGenAI } from "@google/genai";
import { envInt } from "./lib/env.mjs";
import { getClientKey, checkRateLimit } from "./lib/rateLimit.mjs";
import { truncateString } from "./lib/truncate.mjs";

const FUEL_PRICE_PROMPT = `You are helping with Sri Lanka retail fuel prices. Use Google Search to find the latest credible prices (today or most recent official/major media).

Return ONLY valid JSON (no markdown fences, no commentary) with this exact shape:
{
  "governmentPrices": [ { "name": "Octane 92", "lkrPerLiter": 0 } ],
  "privatePrices": [ { "name": "Octane 95", "lkrPerLiter": 0 } ],
  "sourceSummary": "short line: what sources/dates you used"
}

Rules:
- governmentPrices: at most these three if you can verify them: Octane 92 petrol, Normal Diesel (not super/premium unless that is the only diesel named), Kerosene. Government/IOC/Ceypetco-style ceiling prices preferred.
- privatePrices: list all distinct retail grades you find (92, 95, 98, super diesel, etc.). If sources give a range, use the HIGHEST LKR per litre for that grade.
- lkrPerLiter must be a JSON number.
- Omit any product you cannot support from search; do not invent numbers.`;

function parseFuelPricesJson(text) {
  if (typeof text !== "string" || text.length > 500_000) {
    return null;
  }
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function normalizeFuelPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = raw;
  const gov = o.governmentPrices;
  const priv = o.privatePrices;
  if (!Array.isArray(gov) || !Array.isArray(priv)) return null;

  const nameMax = envInt("FUEL_PRICE_NAME_MAX_CHARS", 80);
  const summaryMax = envInt("FUEL_SOURCE_SUMMARY_MAX_CHARS", 500);

  const rows = (arr) =>
    arr
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const rawName = typeof item.name === "string" ? item.name.trim() : "";
        const name = truncateString(rawName, nameMax);
        const n = item.lkrPerLiter;
        const lkr =
          typeof n === "number" && Number.isFinite(n)
            ? n
            : typeof n === "string"
              ? parseFloat(n)
              : NaN;
        if (!name || !Number.isFinite(lkr) || lkr <= 0) return null;
        return { name, lkrPerLiter: lkr };
      })
      .filter(Boolean);

  let summary = typeof o.sourceSummary === "string" ? o.sourceSummary.trim() : "";
  summary = truncateString(summary, summaryMax);
  const sourceSummary = summary || undefined;

  return { governmentPrices: rows(gov), privatePrices: rows(priv), sourceSummary };
}

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
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const rl = checkRateLimit(
    `${getClientKey(req)}:fuel-prices`,
    "RATE_LIMIT_FUEL_PRICES_MAX",
    15
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
    return jsonResponse({ error: "GEMINI_API_KEY not configured." }, 503);
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: FUEL_PRICE_PROMPT,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
        },
      });
    } catch {
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: FUEL_PRICE_PROMPT,
        config: { responseMimeType: "application/json" },
      });
    }
    const text = response.text;
    if (!text) {
      return jsonResponse({ error: "Empty model response." }, 502);
    }
    const parsed = parseFuelPricesJson(text);
    if (!parsed) {
      return jsonResponse({ error: "Invalid JSON from model." }, 502);
    }
    const payload = normalizeFuelPayload(parsed);
    if (!payload) {
      return jsonResponse({ error: "Could not parse fuel prices from model." }, 502);
    }
    return jsonResponse(payload);
  } catch {
    return jsonResponse({ error: "Failed to fetch fuel prices." }, 500);
  }
};

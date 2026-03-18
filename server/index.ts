/**
 * Proxy API for Gemini. Keeps GEMINI_API_KEY server-side only.
 * Dev: run with "npm run api" (port 3001); Vite proxies /api to this.
 * Prod: run with "npm run start" after build; serves dist + /api on PORT.
 */
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Set it in .env or environment.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const PROMPT =
  "Generate a short, depressive, and cynical 'fact' explaining why fuel rationing (like parity-based pumping) is necessary. Blame current and previous governments, uneducated fuel hoarders, and literally everyone except the user. Use a dark, pessimistic tone. Keep it under 3 sentences.";

app.get("/api/generate-fact", async (_req, res) => {
  if (!ai) {
    res.status(503).json({
      text: "The AI is too depressed to answer. Probably because of the government.",
    });
    return;
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: PROMPT,
    });
    const text =
      response.text ||
      "The system is broken, and it's not your fault. It's everyone else's.";
    res.json({ text });
  } catch (_err) {
    res.status(500).json({
      text: "The AI is too depressed to answer. Probably because of the government.",
    });
  }
});

const serveStatic = process.env.SERVE_STATIC === "1" || process.env.NODE_ENV === "production";
if (serveStatic) {
  const dist = path.join(__dirname, "..", "dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

const PORT = Number(process.env.PORT) || (serveStatic ? 3000 : 3001);
app.listen(PORT, () => {
  console.log(
    serveStatic
      ? `App + API on http://localhost:${PORT}`
      : `API server on http://localhost:${PORT} (proxy /api from Vite)`
  );
});

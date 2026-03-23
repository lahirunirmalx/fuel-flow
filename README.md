# FuelFlow

Vite + React SPA with **Netlify Functions** for Gemini (`/api/generate-fact`, `/api/fuel-prices`) and a **public** legacy work-status API: **`GET /api/status`** (same JSON shape as the old *should-I-work-today* service; no API key).  
There is **no Node/Express server** in this repo—only static `dist/` + serverless functions.

## Deploy on Netlify

1. Connect this repo.
2. Build settings are in `netlify.toml` (`npm run build`, publish `dist`, functions `netlify/functions`).
3. Add **`GEMINI_API_KEY`** under **Site configuration → Environment variables** (include **Functions** scope).
4. Optional: tune **`RATE_LIMIT_*`**, **`GENERATE_FACT_MAX_CHARS`**, **`FUEL_*_MAX_CHARS`** — see [`.env.example`](./.env.example) and [SECURITY.md](./SECURITY.md).
5. Deploy.

## Local development

- **UI only (no `/api`):** `npm install` → `npm run dev` — fetches to `/api/*` will fail unless you use Netlify Dev below.
- **UI + API like production:** install [Netlify CLI](https://docs.netlify.com/cli/get-started/) and run:

```bash
npm install
npx netlify dev
```

Set `GEMINI_API_KEY` in a local `.env` in the project root; Netlify CLI injects it into functions.

## Build

Netlify’s build image runs Node to execute `npm run build` (Vite). You do not run or deploy a separate Node server.

## Security

See [SECURITY.md](./SECURITY.md) for threat model, what is (and is not) in the client, and residual risks.

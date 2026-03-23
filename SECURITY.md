# Security notes (FuelFlow)

## What this app does **not** do

- **No secrets in the browser.** `GEMINI_API_KEY` lives only in Netlify (Functions env) or local `.env` for Netlify CLI.
- **No user-controlled strings in Gemini prompts** for `/api/fuel-prices` (fixed server prompt). `/api/generate-fact` uses a fixed prompt only.
- **Plate input** is rendered as React text nodes (default escaping); there is no `dangerouslySetInnerHTML`.
- **Preferences** (plate, job type, theme, sound, UI step) are stored in **first-party cookies** (365 days, `SameSite=Lax`, `Secure` on HTTPS). They are not secrets, but anyone with device access can read them—same as `localStorage`.

## Public API surface

- **`GET /api/status`** — deterministic work-day rules only (no secrets). Responses include `Access-Control-Allow-Origin: *` for simple cross-origin `GET` use.

## Hardening already applied

- **`GET /api/generate-fact` only** — other methods get `405`.
- **In-memory rate limits** (per warm function instance, keyed by client IP from `X-Forwarded-For` / Netlify headers): configurable via `RATE_LIMIT_*` env vars; set `RATE_LIMIT_DISABLED=true` to turn off (e.g. local dev). **Not** a global cap — use Netlify/WAF + Google API quotas for real enforcement.
- **Truncation:** `generate-fact` response text capped (`GENERATE_FACT_MAX_CHARS`, default 4000); fuel `name` / `sourceSummary` capped after normalization (`FUEL_PRICE_NAME_MAX_CHARS`, `FUEL_SOURCE_SUMMARY_MAX_CHARS`).
- Fuel price responses: JSON body size capped before `JSON.parse`; parse wrapped in `try/catch`.
- API responses: `Content-Type: application/json; charset=utf-8` and `X-Content-Type-Options: nosniff`.

## Residual risks (know them)

- **Rate limits are per warm instance**, not global: a determined attacker can still parallelize across IPs or cold starts. Use Google Cloud quotas and Netlify/edge protection for serious deployments.
- **Gemini output** is untrusted text/JSON; we only use structured fields after validation. Do not later pipe model text into `innerHTML` or `eval`.
- **No CSP** in-repo: a strict CSP can conflict with Vite dev; consider a production CSP on Netlify if you add nonces/hashes for scripts.
- **Unofficial tool:** parity and prices are helpers — wrong rules or model hallucination are product risk, not classic CVEs.

## Reporting

If you find a vulnerability, open a private issue or contact the maintainer.

# Security notes (FuelFlow)

## What this app does **not** do

- **No secrets in the browser.** `GEMINI_API_KEY` lives only in Netlify (Functions env) or local `.env` for Netlify CLI.
- **No user-controlled strings in Gemini prompts** for `/api/fuel-prices` (fixed server prompt). `/api/generate-fact` uses a fixed prompt only.
- **Plate input** is rendered as React text nodes (default escaping); there is no `dangerouslySetInnerHTML`.
- **Preferences** (plate, job type, theme, sound, UI step) are stored in **first-party cookies** (365 days, `SameSite=Lax`, `Secure` on HTTPS). They are not secrets, but anyone with device access can read them—same as `localStorage`.

## Hardening already applied

- Fuel price responses: JSON body size capped before `JSON.parse`; parse wrapped in `try/catch`.
- API responses: `Content-Type: application/json; charset=utf-8` and `X-Content-Type-Options: nosniff`.

## Residual risks (know them)

- **Gemini output** is untrusted text/JSON; we only use structured fields after validation. Do not later pipe model text into `innerHTML` or `eval`.
- **No CSP** in-repo: a strict CSP can conflict with Vite dev; consider a production CSP on Netlify if you add nonces/hashes for scripts.
- **Unofficial tool:** parity and prices are helpers — wrong rules or model hallucination are product risk, not classic CVEs.

## Reporting

If you find a vulnerability, open a private issue or contact the maintainer.

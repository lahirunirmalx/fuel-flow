/**
 * Best-effort per-client limits inside one warm function instance.
 * Not global across all Netlify workers — pair with Netlify/WAF or API quotas for real enforcement.
 */

import { envInt } from "./env.mjs";

const buckets = new Map();

function pruneExpired(now) {
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

/**
 * @param {Request} req
 * @returns {string}
 */
export function getClientKey(req) {
  const h = req.headers;
  const xf = h.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const ip =
    h.get("x-nf-client-connection-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("true-client-ip");
  return ip && ip.trim() ? ip.trim() : "unknown";
}

/**
 * @param {string} key — e.g. client IP + route suffix
 * @param {string} envMaxName — env var for max hits per window
 * @param {number} defaultMax
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
export function checkRateLimit(key, envMaxName, defaultMax) {
  if (Netlify.env.get("RATE_LIMIT_DISABLED") === "true") {
    return { ok: true };
  }
  const windowMs = envInt("RATE_LIMIT_WINDOW_MS", 60_000);
  const max = envInt(envMaxName, defaultMax);
  const now = Date.now();
  pruneExpired(now);

  if (buckets.size > 20_000) {
    buckets.clear();
  }

  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > max) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  return { ok: true };
}

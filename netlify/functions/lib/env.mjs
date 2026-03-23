/**
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
export function envInt(name, fallback) {
  const v = Netlify.env.get(name);
  if (v == null || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

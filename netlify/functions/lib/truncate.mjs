/**
 * @param {unknown} s
 * @param {number} max
 * @returns {string}
 */
export function truncateString(s, max) {
  if (typeof s !== "string") return "";
  if (max <= 0) return "";
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

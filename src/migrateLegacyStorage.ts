/**
 * One-time migration from older localStorage keys to cookies (same key names).
 * Runs before React mount so initial state reads cookies.
 */
import Cookies from 'js-cookie';

const PAIRS: [string, string][] = [
  ['fuel-flow-vehicle', 'fuel-flow-vehicle'],
  ['fuel-flow-government', 'fuel-flow-government'],
  ['fuel-flow-essential', 'fuel-flow-essential'],
  ['fuel-flow-theme', 'fuel-flow-theme'],
];

export function migrateLegacyLocalStorageToCookies(): void {
  try {
    const o: Cookies.CookieAttributes = {
      expires: 365,
      sameSite: 'lax',
      path: '/',
    };
    for (const [lsKey, ckKey] of PAIRS) {
      const v = localStorage.getItem(lsKey);
      if (v !== null && v !== '' && Cookies.get(ckKey) === undefined) {
        Cookies.set(ckKey, v, o);
      }
      localStorage.removeItem(lsKey);
    }
  } catch {
    /* storage blocked */
  }
}

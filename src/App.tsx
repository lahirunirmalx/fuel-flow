/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Fuel,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowRight,
  Car,
  Volume2,
  VolumeX,
  Info,
  Skull,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  Briefcase,
  Building2,
  ShieldCheck,
  Clock,
  ChevronDown,
  Edit2,
  XCircle,
  Banknote,
  Sparkles,
  ListChecks,
  Terminal,
  Code,
  X,
} from 'lucide-react';
import Cookies from 'js-cookie';
import { calculateWorkStatus, type Sector } from './utils/workStatus';
import { findNextMatchingPumpDate } from './utils/parityPump';
import type { FuelPriceRow, FuelPricesPayload } from './types/fuelPrices';

/** Cookie names — 365-day persistence, path /, SameSite=Lax. */
const CK = {
  vehicle: 'fuel-flow-vehicle',
  government: 'fuel-flow-government',
  essential: 'fuel-flow-essential',
  theme: 'fuel-flow-theme',
  activeSection: 'fuel-flow-active-section',
  sound: 'fuel-flow-sound',
} as const;

function cookieBaseOpts(): Cookies.CookieAttributes {
  return {
    expires: 365,
    sameSite: 'lax',
    path: '/',
    ...(typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? { secure: true }
      : {}),
  };
}

function readSavedBool(key: string): boolean | null {
  const v = Cookies.get(key);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

function readInitialTheme(): 'light' | 'dark' | 'system' {
  const t = Cookies.get(CK.theme);
  if (t === 'light' || t === 'dark' || t === 'system') return t;
  return 'system';
}

function readInitialActiveSection(): 1 | 2 | 3 {
  const s = Cookies.get(CK.activeSection);
  if (s === '1' || s === '2' || s === '3') return Number(s) as 1 | 2 | 3;
  const g = readSavedBool(CK.government);
  const e = readSavedBool(CK.essential);
  if (g === true) return e !== null ? 3 : 2;
  if (g === false) return 3;
  return 1;
}

/** Keep gov view to Oct 92, normal diesel, kerosene-style rows. */
function isGovernmentFuelRow(r: FuelPriceRow): boolean {
  const n = r.name.toLowerCase();
  if (n.includes('keros')) return true;
  if (n.includes('diesel') && !n.includes('super') && !n.includes('premium')) return true;
  if ((n.includes('92') || n.includes('octane 92')) && !n.includes('95') && !n.includes('98')) return true;
  return false;
}

function pickDisplayPrices(
  payload: FuelPricesPayload | null,
  sector: Sector
): FuelPriceRow[] {
  if (!payload) return [];
  if (sector === 'government') {
    return payload.governmentPrices.filter(isGovernmentFuelRow);
  }
  return [...payload.privatePrices].sort((a, b) => b.lkrPerLiter - a.lkrPerLiter);
}

/** Same patterns as validateAndCheck — used only to guess “complete” on first paint for collapsed state. */
function isPlateFormatValid(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (/^\d+\s*-\s*\d+$/.test(t)) return true;
  return /^[A-Za-z]{2,3}\s*[- ]?\s*\d{4}$/i.test(t);
}

function readInitialEditingProfile(): boolean {
  const g = readSavedBool(CK.government);
  const e = readSavedBool(CK.essential);
  const workReadyInit = g === false || (g === true && e !== null);
  const plate = (Cookies.get(CK.vehicle) ?? '').trim().toUpperCase();
  return !(workReadyInit && isPlateFormatValid(plate));
}

function ProfileSummaryCompact({
  isGovernment,
  isEssential,
  plate,
  lastDigit,
  canPump,
  onEdit,
}: {
  isGovernment: boolean | null;
  isEssential: boolean | null;
  plate: string;
  lastDigit: number;
  canPump: boolean;
  onEdit: () => void;
}) {
  const jobLine =
    isGovernment === true
      ? `Government · ${isEssential === true ? 'Very important' : isEssential === false ? 'Normal job' : '—'}`
      : isGovernment === false
        ? 'Private sector'
        : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 rounded-3xl border border-[#141414]/10 dark:border-white/10 bg-white dark:bg-white/5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
    >
      <div className="space-y-2 min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] dark:text-[#8B8B6B]">
          Your details
        </p>
        <p className="text-sm font-medium text-[#141414] dark:text-white/90">{jobLine}</p>
        <p className="text-sm text-[#141414]/80 dark:text-white/75 break-words">
          <span className="text-[#141414]/45 dark:text-white/40">Plate</span>{' '}
          <span className="font-mono font-semibold tracking-wide break-all">{plate}</span>
          <span className="text-[#141414]/45 dark:text-white/40 text-xs ml-2">
            · last digit {lastDigit} ({lastDigit % 2 === 0 ? 'even' : 'odd'})
          </span>
        </p>
        <p className="text-xs text-[#141414]/55 dark:text-white/45">
          Parity today:{' '}
          <span className="font-medium text-[#141414] dark:text-white/80">
            {canPump ? 'Can refuel' : 'Cannot refuel'}
          </span>{' '}
          — full breakdown below.
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex w-full sm:w-auto min-h-12 items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl border-2 border-[#5A5A40]/45 dark:border-[#8B8B6B]/45 text-sm font-semibold text-[#5A5A40] dark:text-[#8B8B6B] hover:bg-[#5A5A40]/10 dark:hover:bg-[#8B8B6B]/10 transition-colors shrink-0 touch-manipulation active:opacity-90"
      >
        <Edit2 className="w-4 h-4" />
        Edit
      </button>
    </motion.div>
  );
}

function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block touch-manipulation"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#141414] dark:bg-white text-white dark:text-[#141414] text-[10px] font-medium rounded-lg w-max max-w-[min(18rem,calc(100vw-2rem))] text-center shadow-xl pointer-events-none"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#141414] dark:border-t-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type DayName =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

function JobProfileCard({
  isGovernment,
  isEssential,
  onGov,
  onEssential,
  currentDay,
  currentTime,
  activeSection,
  setActiveSection,
}: {
  isGovernment: boolean | null;
  isEssential: boolean | null;
  onGov: (v: boolean) => void;
  onEssential: (v: boolean) => void;
  currentDay: DayName;
  currentTime: string;
  activeSection: 1 | 2 | 3;
  setActiveSection: (n: 1 | 2 | 3) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-7 rounded-3xl bg-white dark:bg-white/5 border border-[#141414]/8 dark:border-white/10 space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-[#5A5A40]/15 dark:bg-[#8B8B6B]/20 p-2 rounded-xl shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#5A5A40] dark:text-[#8B8B6B]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#141414] dark:text-white/90">Should I work today?</h3>
            <p className="text-[10px] uppercase tracking-widest text-[#141414]/45 dark:text-white/35">
              Job type · saved in cookies (365 days)
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <div className="flex items-center justify-end gap-1 text-xs font-mono text-[#141414]/70 dark:text-white/55">
            <Clock className="w-3.5 h-3.5" />
            {currentTime}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#141414]/40 dark:text-white/35">
            {currentDay}
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl border transition-colors ${
          activeSection === 1
            ? 'border-[#5A5A40]/30 bg-[#5A5A40]/5 dark:border-[#8B8B6B]/25 dark:bg-white/[0.03]'
            : 'border-[#141414]/8 dark:border-white/10'
        }`}
      >
        <button
          type="button"
          onClick={() => isGovernment !== null && setActiveSection(1)}
          className="w-full min-h-12 touch-manipulation flex items-center justify-between gap-3 p-4 text-left active:bg-[#141414]/[0.03] dark:active:bg-white/[0.04]"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isGovernment !== null
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-[#141414]/5 dark:bg-white/10 text-[#141414]/35'
              }`}
            >
              {isGovernment !== null ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">1</span>}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#141414] dark:text-white/90">Job type</p>
              {isGovernment !== null && activeSection !== 1 && (
                <p className="text-xs text-[#141414]/55 dark:text-white/45">
                  {isGovernment ? 'Government' : 'Private sector'}
                </p>
              )}
            </div>
          </div>
          {isGovernment !== null && activeSection !== 1 ? <Edit2 className="w-4 h-4 opacity-40" /> : <ChevronDown className="w-4 h-4 text-[#5A5A40]" />}
        </button>
        <AnimatePresence>
          {activeSection === 1 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onGov(true);
                    setActiveSection(2);
                  }}
                  className={`min-h-[3.25rem] touch-manipulation flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:opacity-90 ${
                    isGovernment === true
                      ? 'border-[#5A5A40] dark:border-[#8B8B6B] bg-[#5A5A40]/10'
                      : 'border-[#141414]/10 dark:border-white/10 hover:border-[#141414]/20'
                  }`}
                >
                  <Building2 className="w-5 h-5 shrink-0 opacity-70" />
                  <span className="text-sm font-medium">Government</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onGov(false);
                    setActiveSection(3);
                  }}
                  className={`min-h-[3.25rem] touch-manipulation flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:opacity-90 ${
                    isGovernment === false
                      ? 'border-[#5A5A40] dark:border-[#8B8B6B] bg-[#5A5A40]/10'
                      : 'border-[#141414]/10 dark:border-white/10 hover:border-[#141414]/20'
                  }`}
                >
                  <Briefcase className="w-5 h-5 shrink-0 opacity-70" />
                  <span className="text-sm font-medium">Private sector</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isGovernment === true && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border transition-colors ${
            activeSection === 2
              ? 'border-[#5A5A40]/30 bg-[#5A5A40]/5 dark:border-[#8B8B6B]/25'
              : 'border-[#141414]/8 dark:border-white/10'
          }`}
        >
          <button
            type="button"
            onClick={() => isEssential !== null && setActiveSection(2)}
            className="w-full min-h-12 touch-manipulation flex items-center justify-between gap-3 p-4 text-left active:bg-[#141414]/[0.03] dark:active:bg-white/[0.04]"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isEssential !== null
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-[#141414]/5 dark:bg-white/10 text-[#141414]/35'
                }`}
              >
                {isEssential !== null ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">2</span>}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#141414] dark:text-white/90">Type of work</p>
                {isEssential !== null && activeSection !== 2 && (
                  <p className="text-xs text-[#141414]/55 dark:text-white/45">
                    {isEssential ? 'Very important' : 'Normal job'}
                  </p>
                )}
              </div>
            </div>
            {isEssential !== null && activeSection !== 2 ? <Edit2 className="w-4 h-4 opacity-40" /> : <ChevronDown className="w-4 h-4 text-[#5A5A40]" />}
          </button>
          <AnimatePresence>
            {activeSection === 2 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onEssential(true);
                      setActiveSection(3);
                    }}
                    className={`min-h-[3.25rem] touch-manipulation flex items-center gap-3 p-3 rounded-xl border text-left active:opacity-90 ${
                      isEssential === true
                        ? 'border-[#5A5A40] dark:border-[#8B8B6B] bg-[#5A5A40]/10'
                        : 'border-[#141414]/10 dark:border-white/10'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5 shrink-0 opacity-70" />
                    <span className="text-sm font-medium">Very important</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onEssential(false);
                      setActiveSection(3);
                    }}
                    className={`min-h-[3.25rem] touch-manipulation flex items-center gap-3 p-3 rounded-xl border text-left active:opacity-90 ${
                      isEssential === false
                        ? 'border-[#5A5A40] dark:border-[#8B8B6B] bg-[#5A5A40]/10'
                        : 'border-[#141414]/10 dark:border-white/10'
                    }`}
                  >
                    <XCircle className="w-5 h-5 shrink-0 opacity-70" />
                    <span className="text-sm font-medium">Normal job</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}

function FueleroticaComingSoon() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 sm:p-10 rounded-3xl border-2 border-dashed border-[#5A5A40]/35 dark:border-[#8B8B6B]/30 bg-gradient-to-br from-[#5A5A40]/8 to-transparent dark:from-[#8B8B6B]/10 text-center space-y-4"
    >
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141414]/10 dark:bg-white/10 text-[10px] font-bold uppercase tracking-[0.25em] text-[#5A5A40] dark:text-[#8B8B6B]">
        Coming soon
      </div>
      <div className="flex justify-center">
        <Sparkles className="w-10 h-10 text-[#5A5A40] dark:text-[#8B8B6B] opacity-80" />
      </div>
      <h3 className="font-serif text-2xl sm:text-3xl italic text-[#141414] dark:text-white/90">
        Fuelerotica
      </h3>
      <p className="text-sm text-[#141414]/65 dark:text-white/50 max-w-md mx-auto leading-relaxed">
        A louder, weirder fuel universe is on the way — stories, rants, and rituals for anyone who has
        stared at a pump and questioned their life choices. Stay tuned.
      </p>
      <p className="text-[10px] uppercase tracking-widest text-[#141414]/40 dark:text-white/35">
        You didn&apos;t ask for this feature. You&apos;re getting it anyway.
      </p>
    </motion.div>
  );
}

function ApiReferenceContent({ origin }: { origin: string }) {
  const base = origin || '(your deploy origin)';
  const exampleStatus = `${base}/api/status?sector=government&isEssential=true&dayIndex=1`;

  return (
    <div className="space-y-8">
      <p className="text-sm text-[#141414]/60 dark:text-white/45 leading-relaxed break-words">
        JSON endpoints on this site. <strong className="text-[#141414]/80 dark:text-white/60">GET /api/status</strong>{' '}
        is the same contract as the previous <em>should-I-work-today</em> app (work-day rules only — no plate or
        prices).
      </p>

      {/* Legacy-compatible: work status */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wide">
            GET
          </span>
          <code className="text-sm font-mono text-[#141414] dark:text-white/85">/api/status</code>
        </div>
        <p className="text-xs text-[#141414]/55 dark:text-white/40">
          Query parameters (government sector requires <code className="font-mono">isEssential</code>):
        </p>
        <div className="-mx-1 overflow-x-auto rounded-xl border border-[#141414]/8 dark:border-white/10 sm:mx-0">
          <table className="w-full min-w-[20rem] text-left text-xs sm:text-sm">
            <thead className="bg-[#141414]/[0.04] dark:bg-white/[0.05] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#141414]/45 dark:text-white/40">
              <tr>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3">Parameter</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3">Type</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3">Req</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]/8 dark:divide-white/10">
              <tr>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 font-mono text-[11px] sm:text-xs text-[#5A5A40] dark:text-[#8B8B6B]">sector</td>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 text-[#141414]/70 dark:text-white/55">string</td>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] sm:text-xs">Yes</td>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 text-[#141414]/65 dark:text-white/50 break-words">
                  <code className="font-mono text-[10px] sm:text-xs">government</code> or{' '}
                  <code className="font-mono text-[10px] sm:text-xs">private</code>
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 font-mono text-[11px] sm:text-xs text-[#5A5A40] dark:text-[#8B8B6B]">isEssential</td>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 text-[#141414]/70 dark:text-white/55">boolean</td>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 text-[#141414]/50 dark:text-white/40 text-[11px] sm:text-xs">Gov</td>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 text-[#141414]/65 dark:text-white/50 break-words">
                  <code className="font-mono text-[10px] sm:text-xs">true</code> or <code className="font-mono text-[10px] sm:text-xs">false</code> string
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 font-mono text-[11px] sm:text-xs text-[#5A5A40] dark:text-[#8B8B6B]">dayIndex</td>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 text-[#141414]/70 dark:text-white/55">number</td>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 text-[#141414]/50 dark:text-white/40 text-[11px] sm:text-xs">No</td>
                <td className="px-2 py-2.5 sm:px-4 sm:py-3 text-[#141414]/65 dark:text-white/50 break-words">
                  <code className="font-mono text-[10px] sm:text-xs">0</code>–<code className="font-mono text-[10px] sm:text-xs">6</code>. Default: today (server TZ).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/40 dark:text-white/35">
            Example
          </p>
          <pre className="p-3 sm:p-4 rounded-xl bg-[#141414] dark:bg-zinc-950 text-[10px] sm:text-xs text-zinc-200 overflow-x-auto font-mono break-all whitespace-pre-wrap">
            {`curl "${exampleStatus}"`}
          </pre>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/40 dark:text-white/35">
            Response (success)
          </p>
          <pre className="p-3 sm:p-4 rounded-xl bg-[#141414] dark:bg-zinc-950 text-[10px] sm:text-xs text-zinc-200 overflow-x-auto font-mono whitespace-pre-wrap break-words">{`{
  "status": "Go to Work",
  "detail": "Must report today",
  "message": "You have work today. Please go to your office.",
  "type": "active",
  "color": "text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900"
}`}</pre>
        </div>
      </div>

      <div className="border-t border-[#141414]/10 dark:border-white/10 pt-8 space-y-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[#5A5A40] dark:text-[#8B8B6B]">
          FuelFlow-only endpoints
        </p>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wide">
              GET
            </span>
            <code className="text-sm font-mono">/api/generate-fact</code>
          </div>
          <p className="text-sm text-[#141414]/65 dark:text-white/50">
            <strong className="text-[#141414]/75 dark:text-white/55">GET only</strong> (405 otherwise). Returns{' '}
            <code className="font-mono text-xs">{'{ "text": string }'}</code> — cynical “fact” copy. Requires{' '}
            <code className="font-mono text-xs">GEMINI_API_KEY</code> on the server. Per-IP rate limit may return{' '}
            <code className="font-mono text-xs">429</code> with <code className="font-mono text-xs">Retry-After</code>.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-900 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wide">
              POST
            </span>
            <code className="text-sm font-mono">/api/fuel-prices</code>
          </div>
          <p className="text-sm text-[#141414]/65 dark:text-white/50">
            Body can be empty <code className="font-mono text-xs">{'{}'}</code>. Same per-IP rate limiting as above. Returns{' '}
            <code className="font-mono text-xs">governmentPrices</code>, <code className="font-mono text-xs">privatePrices</code>,{' '}
            <code className="font-mono text-xs">sourceSummary</code>. Requires Gemini + optional Google Search.
          </p>
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-wider text-[#141414]/40 dark:text-white/35 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Code className="w-3.5 h-3.5 shrink-0" />
        <span className="break-words">
          CORS: <code className="font-mono normal-case">GET /api/status</code> →{' '}
          <code className="font-mono normal-case text-[9px] sm:text-[10px]">Access-Control-Allow-Origin: *</code>
        </span>
      </p>
    </div>
  );
}

function ApiReferenceModal({
  open,
  onClose,
  origin,
}: {
  open: boolean;
  onClose: () => void;
  origin: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="api-reference-modal"
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 pt-[env(safe-area-inset-top,0px)] sm:pt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="absolute inset-0 z-0 bg-black/50 dark:bg-black/70 w-full h-full cursor-default border-0 p-0 touch-manipulation"
            aria-label="Close API reference"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-modal-title"
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-[#141414]/15 bg-white shadow-2xl dark:border-white/15 dark:bg-zinc-950 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#141414]/10 px-4 py-3 sm:px-5 sm:py-4 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2">
                <div className="shrink-0 rounded-xl bg-[#5A5A40]/15 p-2 dark:bg-[#8B8B6B]/20">
                  <Terminal className="h-5 w-5 text-[#5A5A40] dark:text-[#8B8B6B]" />
                </div>
                <h2 id="api-modal-title" className="truncate text-base font-semibold text-[#141414] dark:text-white/90">
                  API reference
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 min-h-11 min-w-11 touch-manipulation flex items-center justify-center rounded-xl text-[#141414]/60 transition-colors hover:bg-[#141414]/5 dark:text-white/50 dark:hover:bg-white/10 active:opacity-80"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-5 sm:px-5 sm:py-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
              <ApiReferenceContent origin={origin} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DepressiveFact() {
  const [fact, setFact] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateFact = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate-fact");
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        setFact(
          res.status === 429
            ? "Too many requests. Wait a bit and try again."
            : typeof data.error === "string"
              ? data.error
              : "The AI is too depressed to answer. Probably because of the government."
        );
        return;
      }
      setFact(data.text ?? "The system is broken, and it's not your fault. It's everyone else's.");
    } catch {
      setFact("The AI is too depressed to answer. Probably because of the government.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateFact();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-10 sm:mt-16 p-4 sm:p-6 rounded-3xl bg-[#141414] dark:bg-white/5 text-white/80 dark:text-white/60 border border-white/10 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-red-400/60 min-w-0">
          <Skull className="w-4 h-4 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] truncate">The Harsh Reality</span>
        </div>
        <button 
          type="button"
          onClick={generateFact}
          disabled={loading}
          className="min-h-11 min-w-11 shrink-0 touch-manipulation flex items-center justify-center rounded-full hover:bg-white/5 transition-colors disabled:opacity-30 active:opacity-80"
          aria-label="Refresh fact"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="min-h-[60px] flex items-center">
        {loading ? (
          <div className="space-y-2 w-full">
            <div className="h-2 bg-white/5 rounded-full animate-pulse w-full" />
            <div className="h-2 bg-white/5 rounded-full animate-pulse w-3/4" />
          </div>
        ) : (
          <p className="text-sm font-serif italic leading-relaxed opacity-60 break-words w-full">
            &ldquo;{fact}&rdquo;
          </p>
        )}
      </div>
      
      <div className="pt-4 border-t border-white/5 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center text-[9px] uppercase tracking-widest opacity-30 text-center sm:text-left">
        <span>System Failure: Active</span>
        <span>Blame: Distributed</span>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [input, setInput] = useState(() => Cookies.get(CK.vehicle) ?? '');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const v = Cookies.get(CK.sound);
    if (v === 'false') return false;
    if (v === 'true') return true;
    return true;
  });
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(readInitialTheme);
  const audioCtx = useRef<AudioContext | null>(null);

  const [isGovernment, setIsGovernment] = useState<boolean | null>(() => readSavedBool(CK.government));
  const [isEssential, setIsEssential] = useState<boolean | null>(() => readSavedBool(CK.essential));
  const [activeSection, setActiveSection] = useState<1 | 2 | 3>(readInitialActiveSection);
  const [currentDay, setCurrentDay] = useState<DayName>('Monday');
  const [dayIndex, setDayIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [pricesPayload, setPricesPayload] = useState<FuelPricesPayload | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(readInitialEditingProfile);
  const profileWasCompleteRef = useRef(false);
  const [siteOrigin, setSiteOrigin] = useState('');
  const [apiModalOpen, setApiModalOpen] = useState(false);

  useEffect(() => {
    setSiteOrigin(window.location.origin);
  }, []);

  // Apply theme class and handle system changes
  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (t: 'light' | 'dark' | 'system') => {
      // Remove both classes first
      root.classList.remove('light', 'dark');
      
      let effectiveTheme = t;
      if (t === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      // Add the effective theme class
      root.classList.add(effectiveTheme);
      
      // Specifically for Tailwind's selector strategy, ensure 'dark' class is present/absent
      if (effectiveTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme(theme);

    // If in system mode, listen for changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const toggleTheme = () => {
    const modes: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
    const currentIndex = modes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextTheme = modes[nextIndex];
    
    setTheme(nextTheme);
    Cookies.set(CK.theme, nextTheme, cookieBaseOpts());
  };

  // iOS Sound Fix: Resume AudioContext on first user interaction
  useEffect(() => {
    const resumeAudio = () => {
      if (audioCtx.current && audioCtx.current.state === 'suspended') {
        audioCtx.current.resume();
      }
    };

    window.addEventListener('click', resumeAudio, { once: true });
    window.addEventListener('touchstart', resumeAudio, { once: true });

    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
    };
  }, []);

  useEffect(() => {
    const o = cookieBaseOpts();
    if (input) {
      Cookies.set(CK.vehicle, input, o);
    } else {
      Cookies.remove(CK.vehicle, { path: '/' });
    }
  }, [input]);

  useEffect(() => {
    const o = cookieBaseOpts();
    if (isGovernment !== null) {
      Cookies.set(CK.government, String(isGovernment), o);
    } else {
      Cookies.remove(CK.government, { path: '/' });
    }
  }, [isGovernment]);

  useEffect(() => {
    const o = cookieBaseOpts();
    if (isEssential !== null) {
      Cookies.set(CK.essential, String(isEssential), o);
    } else {
      Cookies.remove(CK.essential, { path: '/' });
    }
  }, [isEssential]);

  useEffect(() => {
    Cookies.set(CK.activeSection, String(activeSection), cookieBaseOpts());
  }, [activeSection]);

  useEffect(() => {
    Cookies.set(CK.sound, String(soundEnabled), cookieBaseOpts());
  }, [soundEnabled]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const days: DayName[] = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      setCurrentDay(days[now.getDay()]);
      setDayIndex(now.getDay());
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const [result, setResult] = useState<{
    isValid: boolean;
    canPump: boolean;
    message: string;
    nextDate?: string;
    lastDigit?: number;
  } | null>(null);

  const playTone = (type: 'valid' | 'invalid' | 'success') => {
    if (!soundEnabled) return;
    
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioCtx.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'valid') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'invalid') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now); // A3
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  const validateAndCheck = (value: string) => {
    if (!value.trim()) {
      setResult(null);
      return;
    }

    // Regex 1: All numbers with a dash (e.g., 1-2234, 17-6789, 302-1054)
    // Robust: Allows any amount of whitespace around the dash
    const pattern1 = /^\d+\s*-\s*\d+$/;
    // Regex 2: 2 or 3 English letters and 4 numbers (e.g., KA-2587, VX 8564, ABA - 2354, CCC 4524)
    // Robust: Allows spaces, dashes, or both between letters and numbers
    const pattern2 = /^[A-Za-z]{2,3}\s*[- ]?\s*\d{4}$/;

    const isValid = pattern1.test(value.trim()) || pattern2.test(value.trim());

    // Sound logic
    if (isValid && !result?.isValid) {
      // If it's valid, we'll check success inside the parity logic to avoid double sounds
    } else if (!isValid && result?.isValid !== false && value.length > 0) {
      playTone('invalid');
    }

    if (!isValid) {
      setResult({
        isValid: false,
        canPump: false,
        message: "Invalid format. Please use formats like '1-2234' or 'KA-2587'.",
      });
      return;
    }

    // Extract last digit
    const lastChar = value.trim().slice(-1);
    const lastDigit = parseInt(lastChar, 10);

    if (isNaN(lastDigit)) {
      setResult({
        isValid: false,
        canPump: false,
        message: "Could not determine the last digit.",
      });
      return;
    }

    const today = new Date();
    const todayDate = today.getDate();
    
    const isTodayOdd = todayDate % 2 !== 0;
    const isDigitOdd = lastDigit % 2 !== 0;
    const canPumpToday = isTodayOdd === isDigitOdd;

    if (canPumpToday) {
      if (!result?.canPump) {
        playTone('success');
      } else if (!result?.isValid) {
        // If it was already valid but we just transitioned from invalid to valid+success
        playTone('success');
      }
      setResult({
        isValid: true,
        canPump: true,
        lastDigit,
        message: "You can refuel today under this parity rule.",
      });
    } else {
      if (!result?.isValid) {
        playTone('valid');
      }
      // Next calendar day whose *day-of-month* parity matches the plate (month-end safe: e.g. 31→1 both odd).
      const nextDate = findNextMatchingPumpDate(today, lastDigit);

      setResult({
        isValid: true,
        canPump: false,
        lastDigit,
        message: "You cannot refuel today under this parity rule.",
        nextDate: nextDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric' 
        }),
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setInput(value);
    validateAndCheck(value);
  };

  const sector: Sector | null =
    isGovernment === true ? 'government' : isGovernment === false ? 'private' : null;
  const workReady =
    sector === 'private' || (sector === 'government' && isEssential !== null);
  const profileComplete = workReady && result?.isValid === true;
  const workResult =
    sector && workReady ? calculateWorkStatus(sector, isEssential, dayIndex) : null;
  const displayRows = sector ? pickDisplayPrices(pricesPayload, sector) : [];

  useEffect(() => {
    if (!profileComplete) {
      setEditingProfile(true);
      profileWasCompleteRef.current = false;
      return;
    }
    if (!profileWasCompleteRef.current) {
      setEditingProfile(false);
    }
    profileWasCompleteRef.current = true;
  }, [profileComplete]);

  const fetchPrices = useCallback(async () => {
    setPriceLoading(true);
    setPriceError(null);
    try {
      const res = await fetch('/api/fuel-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = (await res.json()) as { error?: string } & Partial<FuelPricesPayload>;
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Request failed');
      }
      setPricesPayload({
        governmentPrices: data.governmentPrices ?? [],
        privatePrices: data.privatePrices ?? [],
        sourceSummary: data.sourceSummary,
      });
    } catch (e) {
      setPriceError(e instanceof Error ? e.message : 'Failed to fetch prices');
      setPricesPayload(null);
    } finally {
      setPriceLoading(false);
    }
  }, []);

  const prevWorkReadyRef = useRef(false);
  useEffect(() => {
    if (workReady && !prevWorkReadyRef.current && input.trim()) {
      validateAndCheck(input);
    }
    prevWorkReadyRef.current = workReady;
  }, [workReady, input]);

  /** One automatic fetch per calendar day + plate + sector (manual refresh always calls fetchPrices). */
  const lastAutoFetchKeyRef = useRef<string>('');

  useEffect(() => {
    if (!result?.isValid) {
      setPricesPayload(null);
      setPriceError(null);
      setPriceLoading(false);
      lastAutoFetchKeyRef.current = '';
    }
  }, [result?.isValid]);

  useEffect(() => {
    if (!workReady || !sector || !result?.isValid) {
      return;
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    const plate = input.trim().toUpperCase();
    const k = `${dateKey}|${plate}|${sector}`;
    if (lastAutoFetchKeyRef.current === k) {
      return;
    }
    lastAutoFetchKeyRef.current = k;
    void fetchPrices();
  }, [workReady, sector, result?.isValid, input, fetchPrices]);

  /** Work + parity show immediately; prices load in the background. */
  const showPipeline = workReady && result?.isValid && workResult;

  const summaryPriceLine = priceLoading
    ? 'Loading indicative prices in the background — details below update when ready.'
    : priceError
      ? `Could not load prices (${priceError}).`
      : displayRows.length > 0
        ? `${displayRows.length} product(s) for your sector — see fuel section below.`
        : pricesPayload !== null
          ? 'No price rows matched your sector filter after search.'
          : 'Price data not available yet.';

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#F5F5F0] dark:bg-[#0A0A0A] text-[#141414] dark:text-white/90 font-sans selection:bg-[#5A5A40] selection:text-white transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-[#141414]/10 dark:border-white/10 bg-white/50 dark:bg-black/50 backdrop-blur-md sticky top-0 z-10 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-[#5A5A40] p-2 rounded-lg shrink-0">
              <Fuel className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-serif italic text-lg sm:text-xl font-semibold tracking-tight truncate">FuelFlow</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-4 shrink-0">
            <button 
              type="button"
              onClick={toggleTheme}
              className="min-h-11 min-w-11 touch-manipulation flex items-center justify-center rounded-full hover:bg-[#141414]/5 dark:hover:bg-white/5 transition-colors text-[#141414]/60 dark:text-white/60 gap-2 active:opacity-80"
              title={`Theme: ${theme}`}
            >
              {theme === 'system' && <Monitor className="w-4 h-4" />}
              {theme === 'light' && <Sun className="w-4 h-4" />}
              {theme === 'dark' && <Moon className="w-4 h-4" />}
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">{theme}</span>
            </button>
            <button 
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="min-h-11 min-w-11 touch-manipulation flex items-center justify-center rounded-full hover:bg-[#141414]/5 dark:hover:bg-white/5 transition-colors text-[#141414]/60 dark:text-white/60 active:opacity-80"
              title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <div className="text-xs font-mono opacity-50 uppercase tracking-widest hidden sm:block">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
        <motion.div 
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Hero Section */}
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-medium leading-[1.15] sm:leading-tight break-words">
              Work, fuel rules, <br />
              <span className="italic text-[#5A5A40] dark:text-[#8B8B6B]">and today&apos;s picture.</span>
            </h2>
            <p className="text-sm sm:text-base font-semibold text-[#5A5A40] dark:text-[#8B8B6B] tracking-wide max-w-lg break-words">
              Know before you roll.
            </p>
            <p className="text-[#141414]/60 dark:text-white/40 max-w-lg text-sm sm:text-base leading-relaxed break-words">
              Save your job type and number plate on this device. See whether you should work, if parity lets you refuel
              today, and indicative LKR/litre from search (Gemini) — always verify at the office and the pump.
            </p>
          </div>

          {profileComplete && !editingProfile && result?.isValid && result.lastDigit !== undefined ? (
            <ProfileSummaryCompact
              isGovernment={isGovernment}
              isEssential={isEssential}
              plate={input.trim()}
              lastDigit={result.lastDigit}
              canPump={result.canPump}
              onEdit={() => setEditingProfile(true)}
            />
          ) : (
            <>
              {profileComplete && editingProfile && (
                <div className="flex justify-stretch sm:justify-end px-1 mb-1">
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="w-full sm:w-auto min-h-12 px-4 py-3 rounded-xl bg-[#5A5A40] text-white text-sm font-semibold hover:opacity-90 transition-opacity touch-manipulation active:opacity-95"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Step 1 — Job only */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] dark:text-[#8B8B6B] px-1">
                  Step 1 · Job details
                </p>
                <JobProfileCard
                  isGovernment={isGovernment}
                  isEssential={isEssential}
                  onGov={(v) => {
                    setIsGovernment(v);
                    if (!v) setIsEssential(null);
                  }}
                  onEssential={setIsEssential}
                  currentDay={currentDay}
                  currentTime={currentTime}
                  activeSection={activeSection}
                  setActiveSection={setActiveSection}
                />
                {!workReady && (
                  <p className="text-xs text-[#141414]/50 dark:text-white/40 px-1">
                    Finish government / private (and work type if government) to unlock the vehicle step.
                  </p>
                )}
              </div>

              {/* Step 2 — Vehicle (only after job complete) */}
              <AnimatePresence>
                {workReady && (
                  <motion.div
                    key="vehicle-step"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-3"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] dark:text-[#8B8B6B] px-1">
                      Step 2 · Vehicle number
                    </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/40 dark:text-white/30">
                      Vehicle plate number
                    </label>
                    <Tooltip content="We support numeric (1-2234) and alpha-numeric (KA-2587) formats.">
                      <Info className="w-3 h-3 text-[#141414]/30 dark:text-white/20 cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-3 sm:left-4 flex items-center pointer-events-none">
                      <Car className="w-5 h-5 text-[#141414]/30 dark:text-white/20 group-focus-within:text-[#5A5A40] dark:group-focus-within:text-[#8B8B6B] transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={input}
                      onChange={handleChange}
                      placeholder="e.g. KA-2587 or 1-2234"
                      autoComplete="off"
                      autoCapitalize="characters"
                      enterKeyHint="done"
                      className={`w-full bg-white dark:bg-white/5 border-2 rounded-2xl py-3.5 sm:py-5 pl-11 sm:pl-12 pr-4 sm:pr-6 text-base sm:text-lg md:text-xl font-mono tracking-wider focus:outline-none transition-all shadow-sm touch-manipulation ${
                        !input
                          ? 'border-[#141414]/5 dark:border-white/5 focus:border-[#5A5A40] dark:focus:border-[#8B8B6B]'
                          : result?.isValid
                            ? 'border-emerald-500 focus:border-emerald-600'
                            : 'border-red-500 focus:border-red-600'
                      }`}
                    />
                  </div>
                  {result && !result.isValid && input.trim() !== '' && (
                    <p className="text-sm text-red-600 dark:text-red-400 px-1 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {result.message}
                    </p>
                  )}
                  {result?.isValid && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-1 text-sm text-emerald-800/90 dark:text-emerald-400/90">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Plate OK. Last digit{' '}
                        <span className="font-mono font-bold">{result.lastDigit}</span> (
                        {result.lastDigit! % 2 === 0 ? 'even' : 'odd'}).
                      </span>
                      {priceLoading && (
                        <span className="flex items-center gap-2 text-[#141414]/60 dark:text-white/50">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Pulling today&apos;s indicative prices (Gemini + search)…
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {(!result || !result.isValid) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 sm:p-6 bg-white dark:bg-white/5 rounded-2xl border border-[#141414]/5 dark:border-white/5 space-y-2">
                      <div className="text-[#5A5A40] dark:text-[#8B8B6B] font-bold text-xs uppercase tracking-widest">
                        Rule one
                      </div>
                      <p className="text-sm font-medium">Numeric plates with a dash</p>
                      <p className="text-xs text-[#141414]/40 dark:text-white/30 font-mono break-all">1-2234, 17-6789, 302-1054</p>
                    </div>
                    <div className="p-4 sm:p-6 bg-white dark:bg-white/5 rounded-2xl border border-[#141414]/5 dark:border-white/5 space-y-2">
                      <div className="text-[#5A5A40] dark:text-[#8B8B6B] font-bold text-xs uppercase tracking-widest">
                        Rule two
                      </div>
                      <p className="text-sm font-medium">Alpha-numeric with 4 digits</p>
                      <p className="text-xs text-[#141414]/40 dark:text-white/30 font-mono break-all">KA-2587, VX 8564, ABA - 2354</p>
                    </div>
                  </div>
                )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Step 3–4 — Summary + details immediately; prices section updates when background fetch completes */}
          <AnimatePresence>
            {showPipeline && workResult && result?.isValid && (
              <motion.div
                key="pipeline"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] dark:text-[#8B8B6B] px-1">
                  Step 3 · Summary
                </p>
                <div className="p-4 sm:p-8 rounded-3xl border-2 border-[#5A5A40]/25 dark:border-[#8B8B6B]/30 bg-white dark:bg-white/[0.03] space-y-4">
                  <div className="flex items-center gap-2 text-[#5A5A40] dark:text-[#8B8B6B]">
                    <ListChecks className="w-5 h-5 shrink-0" />
                    <h3 className="text-sm font-bold uppercase tracking-widest">At a glance</h3>
                  </div>
                  <ul className="space-y-2.5 text-sm text-[#141414]/85 dark:text-white/80">
                    <li className="break-words">
                      <strong>Work:</strong> {workResult.status} — {workResult.message}
                    </li>
                    <li className="break-words">
                      <strong>Pump today:</strong>{' '}
                      {result.canPump
                        ? 'Yes (date parity matches your plate).'
                        : `No — next window around ${result.nextDate ?? 'the next matching day'}.`}
                    </li>
                    <li className="break-words">
                      <strong>Indicative prices:</strong> {summaryPriceLine}
                    </li>
                  </ul>
                  <p className="text-[10px] uppercase tracking-wider text-[#141414]/45 dark:text-white/35">
                    AI + search can be wrong — verify at work and at the pump.
                  </p>
                </div>

                <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] dark:text-[#8B8B6B] px-1 pt-2">
                  Step 4 · Explanations
                </p>

                {/* Detail: Work */}
                <motion.div
                  layout
                  className={`p-4 sm:p-7 rounded-3xl border-2 ${workResult.color}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5 opacity-70 shrink-0" />
                    <h4 className="text-xs font-bold uppercase tracking-widest opacity-80">Work status</h4>
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-[#141414] dark:text-white/90 break-words">{workResult.status}</p>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-60 mt-1">{workResult.detail}</p>
                  <p className="text-sm mt-3 leading-relaxed opacity-85 break-words">{workResult.message}</p>
                  <p className="text-xs mt-3 text-[#141414]/55 dark:text-white/45 break-words">
                    Based on sector ({sector === 'government' ? 'government' : 'private'}
                    {sector === 'government' && isEssential !== null
                      ? isEssential
                        ? ', essential / very important role'
                        : ', normal government role'
                      : ''}
                    ) and today being <strong>{currentDay}</strong>.
                  </p>
                </motion.div>

                {/* Detail: Parity pumping */}
                <motion.div
                  layout
                  className={`p-4 sm:p-7 rounded-3xl border-2 ${
                    result.canPump
                      ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/25 dark:bg-emerald-500/10'
                      : 'border-amber-200 bg-amber-50/80 dark:border-amber-500/25 dark:bg-amber-500/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Fuel className="w-5 h-5 opacity-70 shrink-0" />
                    <h4 className="text-xs font-bold uppercase tracking-widest opacity-80">Parity pumping</h4>
                  </div>
                  <p className="text-sm font-semibold text-[#141414] dark:text-white/90 break-words">{result.message}</p>
                  <p className="text-sm mt-3 leading-relaxed text-[#141414]/75 dark:text-white/70 break-words">
                    Today&apos;s calendar date is <strong>{new Date().getDate()}</strong> (
                    {new Date().getDate() % 2 !== 0 ? 'odd' : 'even'}). Your plate&apos;s last digit is{' '}
                    <strong className="font-mono">{result.lastDigit}</strong> (
                    {result.lastDigit! % 2 === 0 ? 'even' : 'odd'}).{' '}
                    {result.canPump
                      ? 'The day of the month and your last digit are both odd or both even, so you may refuel under the parity rule we use here.'
                      : 'They do not match, so wait for a calendar day whose date number has the same odd/even parity as your last digit. Month boundaries are handled (e.g. after the 31st, the 1st can be odd too — we advance day by day until a match).'}
                  </p>
                  {!result.canPump && result.nextDate && (
                    <div className="mt-4 flex flex-col gap-3 p-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-amber-200/60 dark:border-amber-500/20 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-3 min-w-0">
                        <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800/60 dark:text-amber-400/50">
                            Next matching day
                          </p>
                          <p className="font-medium text-amber-900 dark:text-amber-200 break-words">{result.nextDate}</p>
                        </div>
                      </div>
                      <ArrowRight className="hidden sm:block w-4 h-4 text-amber-500 shrink-0 sm:ml-auto" aria-hidden />
                    </div>
                  )}
                </motion.div>

                {/* Detail: Fuel prices (background fetch — skeleton until data arrives) */}
                <motion.div
                  layout
                  className="p-4 sm:p-7 rounded-3xl bg-white dark:bg-white/5 border border-[#141414]/8 dark:border-white/10 space-y-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2 min-w-0">
                      <Banknote className="w-5 h-5 text-[#5A5A40] dark:text-[#8B8B6B] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-[#141414] dark:text-white/90">Fuel prices (today&apos;s pull)</h4>
                        <p className="text-[10px] uppercase tracking-widest text-[#141414]/45 dark:text-white/35 break-words">
                          {sector === 'government'
                            ? 'Government view: Oct 92, normal diesel, kerosene'
                            : 'Private view: all grades found, highest LKR/L per type'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void fetchPrices();
                      }}
                      disabled={priceLoading}
                      className="inline-flex w-full sm:w-auto shrink-0 min-h-12 items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl bg-[#5A5A40] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity touch-manipulation active:opacity-95"
                    >
                      <RefreshCw className={`w-4 h-4 ${priceLoading ? 'animate-spin' : ''}`} />
                      {priceLoading ? 'Searching…' : 'Refresh prices'}
                    </button>
                  </div>
                  <p className="text-sm text-[#141414]/65 dark:text-white/50 leading-relaxed break-words">
                    These numbers come from a one-shot Gemini request with optional Google Search. They are{' '}
                    <strong>not</strong> official quotes — always confirm on the forecourt or government notices.
                  </p>
                  {priceLoading && (
                    <div className="space-y-3" aria-busy="true" aria-label="Loading fuel prices">
                      <p className="text-xs font-medium text-[#5A5A40] dark:text-[#8B8B6B] flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                        Fetching in the background — you can read work and parity above while this finishes.
                      </p>
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="flex justify-between gap-4 py-2 border-b border-[#141414]/6 dark:border-white/10"
                          >
                            <div className="h-4 bg-[#141414]/10 dark:bg-white/10 rounded animate-pulse w-2/5" />
                            <div className="h-4 bg-[#141414]/10 dark:bg-white/10 rounded animate-pulse w-24" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {priceError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{priceError}</p>
                  )}
                  {!priceLoading && displayRows.length > 0 && (
                    <ul className="space-y-2">
                      {displayRows.map((row) => (
                        <li
                          key={row.name + row.lkrPerLiter}
                          className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm py-3 sm:py-2 border-b border-[#141414]/8 dark:border-white/10 last:border-0"
                        >
                          <span className="text-[#141414]/80 dark:text-white/70 break-words pr-2">{row.name}</span>
                          <span className="font-mono font-semibold shrink-0 sm:text-right">
                            LKR {row.lkrPerLiter.toFixed(2)}
                            <span className="text-[10px] font-sans font-normal opacity-60 ml-1">/L</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!priceLoading && pricesPayload?.sourceSummary && (
                    <p className="text-xs text-[#141414]/50 dark:text-white/40 italic">{pricesPayload.sourceSummary}</p>
                  )}
                  {!priceLoading && !priceError && pricesPayload !== null && displayRows.length === 0 && (
                    <p className="text-sm text-[#141414]/55 dark:text-white/45">No rows matched your sector filter.</p>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <FueleroticaComingSoon />
          <DepressiveFact />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-12 border-t border-[#141414]/5 dark:border-white/5 mt-8 sm:mt-12 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 opacity-40 text-xs uppercase tracking-widest font-medium text-center md:text-left">
          <p>© 2026 FuelFlow Systems</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 sm:gap-8">
            <button
              type="button"
              onClick={() => setApiModalOpen(true)}
              className="min-h-11 min-w-[2.75rem] inline-flex items-center justify-center bg-transparent border-0 px-2 cursor-pointer font-[inherit] uppercase tracking-widest hover:text-[#5A5A40] dark:hover:text-[#8B8B6B] transition-colors touch-manipulation active:opacity-70"
            >
              API
            </button>
            <a
              href="#"
              className="min-h-11 inline-flex items-center px-2 hover:text-[#5A5A40] dark:hover:text-[#8B8B6B] transition-colors touch-manipulation active:opacity-70"
            >
              Privacy
            </a>
            <a
              href="#"
              className="min-h-11 inline-flex items-center px-2 hover:text-[#5A5A40] dark:hover:text-[#8B8B6B] transition-colors touch-manipulation active:opacity-70"
            >
              Terms
            </a>
            <a
              href="#"
              className="min-h-11 inline-flex items-center px-2 hover:text-[#5A5A40] dark:hover:text-[#8B8B6B] transition-colors touch-manipulation active:opacity-70"
            >
              Support
            </a>
          </div>
        </div>
      </footer>

      <ApiReferenceModal
        open={apiModalOpen}
        onClose={() => setApiModalOpen(false)}
        origin={siteOrigin}
      />
    </div>
  );
}

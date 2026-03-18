/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fuel, CheckCircle2, AlertCircle, Calendar, ArrowRight, Car, Volume2, VolumeX, Info, Skull, RefreshCw, Sun, Moon, Monitor } from 'lucide-react';

function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)} onClick={() => setIsVisible(!isVisible)}>
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#141414] dark:bg-white text-white dark:text-[#141414] text-[10px] font-medium rounded-lg w-max max-w-[200px] text-center shadow-xl pointer-events-none"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#141414] dark:border-t-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DepressiveFact() {
  const [fact, setFact] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateFact = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate-fact");
      const data = await res.json();
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
      className="mt-16 p-6 rounded-3xl bg-[#141414] dark:bg-white/5 text-white/80 dark:text-white/60 border border-white/10 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-red-400/60">
          <Skull className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">The Harsh Reality</span>
        </div>
        <button 
          onClick={generateFact}
          disabled={loading}
          className="p-2 hover:bg-white/5 rounded-full transition-colors disabled:opacity-30"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="min-h-[60px] flex items-center">
        {loading ? (
          <div className="space-y-2 w-full">
            <div className="h-2 bg-white/5 rounded-full animate-pulse w-full" />
            <div className="h-2 bg-white/5 rounded-full animate-pulse w-3/4" />
          </div>
        ) : (
          <p className="text-sm font-serif italic leading-relaxed opacity-60">
            "{fact}"
          </p>
        )}
      </div>
      
      <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[9px] uppercase tracking-widest opacity-30">
        <span>System Failure: Active</span>
        <span>Blame: Distributed</span>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const audioCtx = useRef<AudioContext | null>(null);
  const lastPlayed = useRef<string | null>(null);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('fuel-flow-theme') as 'light' | 'dark' | 'system' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
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
    localStorage.setItem('fuel-flow-theme', nextTheme);
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
        message: "You can pump gas today!",
      });
    } else {
      if (!result?.isValid) {
        playTone('valid');
      }
      // Calculate next available date
      // Calculate next available date
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + 1);
      
      // If the next day still doesn't match parity (e.g. 31st to 1st), keep going
      // Actually, parity always flips unless it's 31st to 1st (both odd)
      while ((nextDate.getDate() % 2 !== 0) !== isDigitOdd) {
        nextDate.setDate(nextDate.getDate() + 1);
      }

      setResult({
        isValid: true,
        canPump: false,
        lastDigit,
        message: "You cannot pump gas today.",
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

  return (
    <div className="min-h-screen bg-[#F5F5F0] dark:bg-[#0A0A0A] text-[#141414] dark:text-white/90 font-sans selection:bg-[#5A5A40] selection:text-white transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-[#141414]/10 dark:border-white/10 bg-white/50 dark:bg-black/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#5A5A40] p-2 rounded-lg">
              <Fuel className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-serif italic text-xl font-semibold tracking-tight">FuelFlow</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-[#141414]/5 dark:hover:bg-white/5 rounded-full transition-colors text-[#141414]/60 dark:text-white/60 flex items-center gap-2"
              title={`Theme: ${theme}`}
            >
              {theme === 'system' && <Monitor className="w-4 h-4" />}
              {theme === 'light' && <Sun className="w-4 h-4" />}
              {theme === 'dark' && <Moon className="w-4 h-4" />}
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">{theme}</span>
            </button>
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 hover:bg-[#141414]/5 dark:hover:bg-white/5 rounded-full transition-colors text-[#141414]/60 dark:text-white/60"
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

      <main className="max-w-2xl mx-auto px-6 py-12">
        <motion.div 
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Hero Section */}
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-serif font-medium leading-tight">
              Check your gas <br />
              <span className="italic text-[#5A5A40] dark:text-[#8B8B6B]">pumping eligibility.</span>
            </h2>
            <p className="text-[#141414]/60 dark:text-white/40 max-w-md text-sm sm:text-base">
              Enter your vehicle number plate to see if you can refuel today based on the last digit parity.
            </p>
          </div>

          {/* Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/40 dark:text-white/30">Vehicle Plate Number</label>
              <Tooltip content="We support numeric (1-2234) and alpha-numeric (KA-2587) formats.">
                <Info className="w-3 h-3 text-[#141414]/30 dark:text-white/20 cursor-help" />
              </Tooltip>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Car className="w-5 h-5 text-[#141414]/30 dark:text-white/20 group-focus-within:text-[#5A5A40] dark:group-focus-within:text-[#8B8B6B] transition-colors" />
              </div>
              <input
                type="text"
                value={input}
                onChange={handleChange}
                placeholder="e.g. KA-2587 or 1-2234"
                className={`w-full bg-white dark:bg-white/5 border-2 rounded-2xl py-4 sm:py-5 pl-12 pr-6 text-lg sm:text-xl font-mono tracking-wider focus:outline-none transition-all shadow-sm ${
                  !input 
                    ? 'border-[#141414]/5 dark:border-white/5 focus:border-[#5A5A40] dark:focus:border-[#8B8B6B]' 
                    : result?.isValid 
                      ? 'border-emerald-500 focus:border-emerald-600' 
                      : 'border-red-500 focus:border-red-600'
                }`}
              />
            </div>
          </div>

          {/* Results & Info Section */}
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key={result.message + result.isValid}
                initial={{ opacity: 0, scale: 0.9, y: 20, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.9, 
                  y: 60, 
                  rotateX: -15,
                  filter: "blur(20px)" 
                }}
                transition={{ 
                  duration: 0.4,
                  ease: [0.4, 0, 0.2, 1]
                }}
                className={`p-6 sm:p-8 rounded-3xl border-2 ${
                  !result.isValid 
                    ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20' 
                    : result.canPump 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' 
                      : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                  <div className={`p-3 rounded-2xl shrink-0 ${
                    !result.isValid 
                      ? 'bg-red-500 text-white' 
                      : result.canPump 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-amber-500 text-white'
                  }`}>
                    {!result.isValid ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`text-lg font-semibold ${
                          !result.isValid ? 'text-red-900 dark:text-red-400' : result.canPump ? 'text-emerald-900 dark:text-emerald-400' : 'text-amber-900 dark:text-amber-400'
                        }`}>
                          {result.message}
                        </h3>
                        <Tooltip content={!result.isValid ? "Check the format rules below." : result.canPump ? "Your plate parity matches today's date parity." : "Your plate parity does not match today's date parity."}>
                          <Info className={`w-3.5 h-3.5 cursor-help ${!result.isValid ? 'text-red-400' : result.canPump ? 'text-emerald-400' : 'text-amber-400'}`} />
                        </Tooltip>
                      </div>
                      {result.isValid && (
                        <p className="text-sm opacity-70 mt-1">
                          Last digit: <span className="font-mono font-bold">{result.lastDigit}</span> ({result.lastDigit! % 2 === 0 ? 'Even' : 'Odd'})
                        </p>
                      )}
                    </div>

                    {result.isValid && !result.canPump && result.nextDate && (
                      <div className="bg-white/50 dark:bg-white/5 rounded-2xl p-4 border border-amber-200/50 dark:border-amber-500/20 flex items-center gap-4">
                        <div className="bg-amber-100 dark:bg-amber-500/20 p-2 rounded-lg text-amber-700 dark:text-amber-400">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider font-bold text-amber-800/50 dark:text-amber-400/40">Next Available Date</p>
                          <p className="text-amber-900 dark:text-amber-200 font-medium">{result.nextDate}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 ml-auto text-amber-400" />
                      </div>
                    )}

                    {result.isValid && result.canPump && (
                      <p className="text-sm text-emerald-800/60 dark:text-emerald-400/60">
                        Today's date is <span className="font-bold">{new Date().getDate()}</span>, which matches your plate's parity.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="info-cards"
                initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.9, 
                  y: -40, 
                  filter: "blur(15px)" 
                }}
                transition={{ 
                  duration: 0.3, 
                  ease: [0.4, 0, 1, 1] 
                }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-[#141414]/5 dark:border-white/5 space-y-2">
                  <div className="text-[#5A5A40] dark:text-[#8B8B6B] font-bold text-xs uppercase tracking-widest">Rule One</div>
                  <p className="text-sm font-medium">Numeric plates with a dash</p>
                  <p className="text-xs text-[#141414]/40 dark:text-white/30 font-mono">1-2234, 17-6789, 302-1054</p>
                </div>
                <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-[#141414]/5 dark:border-white/5 space-y-2">
                  <div className="text-[#5A5A40] dark:text-[#8B8B6B] font-bold text-xs uppercase tracking-widest">Rule Two</div>
                  <p className="text-sm font-medium">Alpha-numeric with 4 digits</p>
                  <p className="text-xs text-[#141414]/40 dark:text-white/30 font-mono">KA-2587, VX 8564, ABA - 2354</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <DepressiveFact />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-6 py-12 border-t border-[#141414]/5 dark:border-white/5 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 opacity-40 text-xs uppercase tracking-widest font-medium">
          <p>© 2026 FuelFlow Systems</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-[#5A5A40] dark:hover:text-[#8B8B6B] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#5A5A40] dark:hover:text-[#8B8B6B] transition-colors">Terms</a>
            <a href="#" className="hover:text-[#5A5A40] dark:hover:text-[#8B8B6B] transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

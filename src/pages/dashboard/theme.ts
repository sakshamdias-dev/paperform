import { useEffect, useState } from 'react';

export type ColorSchemePref = 'light dark' | 'light' | 'dark';

const STORAGE_KEY = 'color-scheme';
const CHANGE_EVENT = 'qf:color-scheme-change';

function getMeta(): HTMLMetaElement | null {
  if (typeof document === 'undefined') return null;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'color-scheme';
    meta.content = 'light dark';
    document.head.appendChild(meta);
  }
  return meta;
}

export function getStoredColorScheme(): ColorSchemePref {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
  } catch {
    // ignore blocked storage
  }
  return 'light dark';
}

export function getSystemScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getResolvedColorScheme(pref: ColorSchemePref = getStoredColorScheme()): 'light' | 'dark' {
  return pref === 'light' || pref === 'dark' ? pref : getSystemScheme();
}

export function applyColorScheme(pref: ColorSchemePref) {
  const meta = getMeta();
  if (meta) meta.content = pref;
  try {
    if (pref === 'light dark') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  } catch {
    // ignore blocked storage
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

/**
 * Two-state toggle per `dark-mode-toggle` guidance:
 * flips the currently rendered scheme; if the target matches the current OS preference,
 * clears the stored override so the page returns to following the system default.
 */
export function toggleColorScheme() {
  const stored = getStoredColorScheme();
  const sys = getSystemScheme();
  const currentRendered = stored === 'light' || stored === 'dark' ? stored : sys;
  const target: 'light' | 'dark' = currentRendered === 'dark' ? 'light' : 'dark';
  if (target === sys) {
    applyColorScheme('light dark');
  } else {
    applyColorScheme(target);
  }
}

export function useColorScheme() {
  const [pref, setPref] = useState<ColorSchemePref>(() => getStoredColorScheme());
  const [sys, setSys] = useState<'light' | 'dark'>(() => getSystemScheme());

  useEffect(() => {
    const sync = () => {
      setPref(getStoredColorScheme());
      setSys(getSystemScheme());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        const next = getStoredColorScheme();
        const meta = getMeta();
        if (meta) meta.content = next;
        sync();
      }
    };
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onMedia = () => setSys(mql.matches ? 'dark' : 'light');

    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', onStorage);
    mql.addEventListener('change', onMedia);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
      mql.removeEventListener('change', onMedia);
    };
  }, []);

  const resolved: 'light' | 'dark' = pref === 'light' || pref === 'dark' ? pref : sys;

  return {
    pref,
    systemScheme: sys,
    resolved,
    setColorScheme: applyColorScheme,
    toggleColorScheme,
  };
}


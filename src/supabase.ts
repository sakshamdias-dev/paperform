import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const STORAGE_KEY = 'questforma-auth';
const LEGACY_STORAGE_KEY = 'paperform-auth';

// One-time migration from legacy storage key so stale tokens never cause refresh loops
try {
  const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacyValue) {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, legacyValue);
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
} catch {
  // Ignore storage errors
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: STORAGE_KEY,
  },
});

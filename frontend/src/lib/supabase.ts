import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bxtqwqarxddrnkshwezg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_sNGNyPCqbfKu5Tum52iaUA_K5J9ODd_";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

export function getDeviceIdentifier(): { id: string; name: string; type: string } {
  let id = localStorage.getItem('chatpilot_device_id');
  if (!id) {
    id = 'dev-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
    localStorage.setItem('chatpilot_device_id', id);
  }
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const name = isAndroid ? 'Redmi Note 13 Pro 5G' : 'Windows Workstation';
  const type = isAndroid ? 'android' : 'windows';
  return { id, name, type };
}


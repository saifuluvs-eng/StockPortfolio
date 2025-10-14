import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON as string;

// Do not throw; just warn if envs are missing so app doesn't crash
if (!url || !anon) {
  console.warn('Supabase envs missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON');
}

export const supabase = createClient(url, anon);

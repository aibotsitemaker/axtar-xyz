import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (typeof window !== 'undefined' && (!url || !key)) {
  console.error('Supabase mühit dəyişənləri (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) təyin edilməyib.');
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-anon-key');

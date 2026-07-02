import { createClient } from '@supabase/supabase-js';

// Read URL and anon key from Vite env variables
// For local testing fallback, can use placeholders or instruct client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-supabase-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This fires if the .env.local file is missing or the app hasn't been
  // restarted since adding it — see README.md step 4.
  console.warn(
    "Missing Supabase environment variables. Check .env.local — see README.md."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

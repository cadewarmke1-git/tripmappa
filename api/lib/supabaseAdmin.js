/**
 * Server-side Supabase admin client for Vercel serverless routes in api/.
 * Env: process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY
 * Never import this module from frontend code.
 */
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

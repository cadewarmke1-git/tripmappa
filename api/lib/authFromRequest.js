import { getSupabaseAdmin } from "./supabaseAdmin.js";

/** Extract authenticated Supabase user from Bearer token on API requests. */
export async function getUserFromRequest(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.slice(7);
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

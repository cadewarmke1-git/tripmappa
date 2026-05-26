import { supabase } from "./supabaseClient.js";

const GUEST_HOME_KEY = "tripmappa-home-address";

export function getGuestHomeAddress() {
  try {
    return sessionStorage.getItem(GUEST_HOME_KEY) || "";
  } catch {
    return "";
  }
}

export function setGuestHomeAddress(address) {
  try {
    sessionStorage.setItem(GUEST_HOME_KEY, address);
  } catch {
    /* ignore */
  }
}

export async function fetchUserProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("home_address, tier, generations_used, credits_month")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveHomeAddress(userId, homeAddress) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      { user_id: userId, home_address: homeAddress.trim() },
      { onConflict: "user_id" },
    )
    .select("home_address")
    .single();
  if (error) throw error;
  return data;
}

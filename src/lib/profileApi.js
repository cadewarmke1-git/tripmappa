import { supabase } from "./supabaseClient.js";
import { resizeImageToSquare } from "./avatarUtils.js";

const GUEST_HOME_KEY = "tripmappa-home-address";

const PROFILE_FIELDS = "display_name, avatar_url, home_address, emergency_contact_phone, tier, generations_used, credits_month, notify_trip_reminders, notify_new_features, premium_renewal_at, founder_expires_at, referral_code, created_at";

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
    .select(PROFILE_FIELDS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertUserProfile(userId, patch) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
    .select(PROFILE_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function saveHomeAddress(userId, homeAddress) {
  return upsertUserProfile(userId, { home_address: homeAddress.trim() });
}

export async function saveEmergencyContact(userId, phone) {
  return upsertUserProfile(userId, { emergency_contact_phone: phone.trim() });
}

export async function saveDisplayName(userId, displayName) {
  return upsertUserProfile(userId, { display_name: displayName.trim() });
}

export async function saveNotificationPrefs(userId, prefs) {
  return upsertUserProfile(userId, {
    notify_trip_reminders: prefs.notifyTripReminders,
    notify_new_features: prefs.notifyNewFeatures,
  });
}

export async function uploadAvatar(userId, file) {
  if (!supabase) throw new Error("Supabase is not configured");
  const blob = await resizeImageToSquare(file, 200);
  const path = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const profile = await upsertUserProfile(userId, { avatar_url: avatarUrl });
  return profile;
}

import { supabase } from "./supabaseClient.js";
import { resizeImageToSquare } from "./avatarUtils.js";

const GUEST_HOME_KEY = "tripmappa-home-address";

const PROFILE_FIELDS = "display_name, avatar_url, home_address, emergency_contact_phone, tier, generations_used, credits_month, notify_trip_reminders, notify_new_features, premium_renewal_at, founder_expires_at, referral_code, created_at, traveler_profile, onboarding_complete";

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

async function requireAuthenticatedUser() {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) throw new Error("Not signed in");
  return user;
}

export async function fetchUserProfile() {
  if (!supabase) return null;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_FIELDS)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertUserProfile(patch) {
  const user = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({ ...patch, user_id: user.id }, { onConflict: "user_id" })
    .select(PROFILE_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function saveHomeAddress(homeAddress) {
  return upsertUserProfile({ home_address: homeAddress.trim() });
}

export async function saveEmergencyContact(phone) {
  return upsertUserProfile({ emergency_contact_phone: phone.trim() });
}

export async function saveDisplayName(displayName) {
  return upsertUserProfile({ display_name: displayName.trim() });
}

export async function saveNotificationPrefs(prefs) {
  return upsertUserProfile({
    notify_trip_reminders: prefs.notifyTripReminders,
    notify_new_features: prefs.notifyNewFeatures,
  });
}

export async function saveTravelerOnboarding(travelerProfile) {
  return upsertUserProfile({
    traveler_profile: travelerProfile || {},
    onboarding_complete: true,
  });
}

export async function uploadAvatar(file) {
  const user = await requireAuthenticatedUser();
  const blob = await resizeImageToSquare(file, 200);
  const path = `${user.id}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const profile = await upsertUserProfile({ avatar_url: avatarUrl });
  return profile;
}

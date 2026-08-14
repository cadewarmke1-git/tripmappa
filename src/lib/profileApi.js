import { supabase } from "./supabaseClient.js";
import { resizeImageToSquare } from "./avatarUtils.js";

const GUEST_HOME_KEY = "tripmappa-home-address";

const PROFILE_FIELDS = "display_name, avatar_url, home_address, emergency_contact_phone, tier, generations_used, credits_month, notify_trip_reminders, notify_new_features, premium_renewal_at, founder_expires_at, referral_code, created_at, traveler_profile, onboarding_complete";

/** Client may only write these columns — billing/credits are server-only. */
const CLIENT_WRITABLE_PROFILE_KEYS = new Set([
  "display_name",
  "avatar_url",
  "home_address",
  "emergency_contact_phone",
  "notify_trip_reminders",
  "notify_new_features",
  "traveler_profile",
  "onboarding_complete",
]);

function sanitizeClientProfilePatch(patch) {
  const out = {};
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return out;
  for (const [key, value] of Object.entries(patch)) {
    if (!CLIENT_WRITABLE_PROFILE_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

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
  const safePatch = sanitizeClientProfilePatch(patch);
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({ ...safePatch, user_id: user.id }, { onConflict: "user_id" })
    .select(PROFILE_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function saveHomeAddress(homeAddress) {
  const trimmed = String(homeAddress || "").trim().slice(0, 300);
  return upsertUserProfile({ home_address: trimmed });
}

export async function saveEmergencyContact(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) {
    return upsertUserProfile({ emergency_contact_phone: "" });
  }
  // Store E.164-ish US numbers only — rejects freeform junk without full field encryption.
  if (digits.length === 10) {
    return upsertUserProfile({ emergency_contact_phone: `+1${digits}` });
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return upsertUserProfile({ emergency_contact_phone: `+${digits}` });
  }
  throw new Error("Enter a valid 10-digit US phone number");
}

export async function saveDisplayName(displayName) {
  return upsertUserProfile({ display_name: String(displayName || "").trim().slice(0, 80) });
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

const AVATAR_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_MAX_RAW_BYTES = 5 * 1024 * 1024; // 5MB raw before resize (bucket caps at 512KB)

export async function uploadAvatar(file) {
  if (!file || typeof file !== "object") {
    throw new Error("Choose a photo to upload");
  }
  if (!AVATAR_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Use a JPEG, PNG, or WebP image");
  }
  if (typeof file.size === "number" && file.size > AVATAR_MAX_RAW_BYTES) {
    throw new Error("Image must be 5MB or smaller");
  }

  const user = await requireAuthenticatedUser();
  const blob = await resizeImageToSquare(file, 200);
  if (blob.size > 524288) {
    throw new Error("Processed image is too large");
  }
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

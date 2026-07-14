/** Client-side avatar helpers — resize before upload, initials fallback. */

function firstNonEmpty(...values) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function firstNameToken(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/).filter(Boolean)[0] || "";
}

/**
 * Resolve account name for greetings / avatar.
 * Prefer profile.display_name, then full_name (profile or auth metadata), then email prefix.
 */
export function getDisplayName(user, profile) {
  const displayName = firstNonEmpty(profile?.display_name);
  if (displayName) return displayName;

  const fullName = firstNonEmpty(
    profile?.full_name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
  );
  if (fullName) return fullName;

  return firstNonEmpty(user?.email?.split("@")[0]) || "Traveler";
}

/** Greeting-ready first name using the same priority as getDisplayName. */
export function getGreetingFirstName(user, profile) {
  const displayName = firstNonEmpty(profile?.display_name);
  if (displayName) return firstNameToken(displayName);

  const fullName = firstNonEmpty(
    profile?.full_name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
  );
  if (fullName) return firstNameToken(fullName);

  return firstNonEmpty(user?.email?.split("@")[0]) || "Traveler";
}

export function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "TM";
}

/**
 * Resize an image file to a square JPEG blob (default 200×200).
 * @param {File} file
 * @param {number} size
 * @returns {Promise<Blob>}
 */
export function resizeImageToSquare(file, size = 200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image"));
        return;
      }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error("Could not compress image"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image file"));
    };
    img.src = url;
  });
}

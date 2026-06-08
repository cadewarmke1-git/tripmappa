export function getHereAccessKeyId() {
  return process.env.HERE_ACCESS_KEY_ID || "";
}

export function getHereAccessKeySecret() {
  return process.env.HERE_ACCESS_KEY_SECRET || "";
}

export function hasHereCredentials() {
  return Boolean(getHereAccessKeyId() && getHereAccessKeySecret());
}

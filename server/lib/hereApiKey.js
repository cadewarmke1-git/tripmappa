export function getHereApiKey() {
  return process.env.HERE_API_KEY || process.env.VITE_HERE_API_KEY || "";
}

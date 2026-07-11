import crypto from "crypto";
import { getHereAccessKeyId, getHereAccessKeySecret } from "./hereApiKey.js";

const TOKEN_URL = "https://account.api.here.com/oauth2/token";
const CACHE_TTL_MS = 23 * 60 * 60 * 1000;

/** @type {{ token: string | null, expiresAt: number }} */
const cache = { token: null, expiresAt: 0 };
/** @type {Promise<string> | null} */
let inflight = null;

function encodeRFC3986(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildParameterString(params) {
  return Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join("&");
}

function buildSignatureBaseString({ method, url, params }) {
  const encodedParameterString = encodeRFC3986(buildParameterString(params));
  return [
    method.toUpperCase(),
    encodeRFC3986(url),
    encodedParameterString,
  ].join("&");
}

function buildOAuthSignature({ method, url, params, accessKeySecret }) {
  const baseString = buildSignatureBaseString({ method, url, params });
  const signingKey = `${accessKeySecret}&`;
  const digest = crypto.createHmac("sha256", signingKey).update(baseString).digest("base64");
  return encodeRFC3986(digest);
}

function buildOAuthAuthorizationHeader({ accessKeyId, accessKeySecret }) {
  const oauthTimestamp = String(Math.floor(Date.now() / 1000));
  const oauthNonce = crypto.randomBytes(16).toString("hex");

  const signatureParams = {
    grant_type: "client_credentials",
    oauth_consumer_key: accessKeyId,
    oauth_nonce: oauthNonce,
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: oauthTimestamp,
    oauth_version: "1.0",
  };

  const oauthSignature = buildOAuthSignature({
    method: "POST",
    url: TOKEN_URL,
    params: signatureParams,
    accessKeySecret,
  });

  return [
    `oauth_consumer_key="${signatureParams.oauth_consumer_key}"`,
    `oauth_nonce="${signatureParams.oauth_nonce}"`,
    `oauth_signature="${oauthSignature}"`,
    `oauth_signature_method="${signatureParams.oauth_signature_method}"`,
    `oauth_timestamp="${signatureParams.oauth_timestamp}"`,
    `oauth_version="${signatureParams.oauth_version}"`,
  ].join(",");
}

async function fetchAccessToken() {
  const accessKeyId = getHereAccessKeyId();
  const accessKeySecret = getHereAccessKeySecret();
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("HERE access credentials not configured");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `OAuth ${buildOAuthAuthorizationHeader({ accessKeyId, accessKeySecret })}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.message || data.error || "HERE OAuth token request failed";
    throw new Error(msg);
  }

  const token = data.access_token || data.accessToken;
  if (!token) {
    throw new Error("HERE OAuth response missing access token");
  }

  return token;
}

export async function getHereAccessToken() {
  const now = Date.now();
  if (cache.token && now < cache.expiresAt) {
    return cache.token;
  }

  if (!inflight) {
    inflight = fetchAccessToken()
      .then((token) => {
        cache.token = token;
        cache.expiresAt = Date.now() + CACHE_TTL_MS;
        return token;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

// Sesión por PIN: cookie firmada con HMAC. Usa Web Crypto para correr igual en proxy y en server.

export const SESSION_COOKIE = "burgundy_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 días, que no pida el PIN a cada rato

const encoder = new TextEncoder();

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres)");
  }
  return value;
}

async function hmac(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken() {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = String(expires);
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (Number(payload) < Date.now()) return false;
  return timingSafeEqual(signature, await hmac(payload));
}

export function checkPin(pin: string) {
  const expected = process.env.APP_PIN;
  if (!expected) throw new Error("Falta APP_PIN");
  return timingSafeEqual(pin, expected);
}

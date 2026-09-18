import "server-only";

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return;
  if (new URL(origin).host !== host) throw new Error("ORIGIN_MISMATCH");
}

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("fr-FR");
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltHex, hashHex] = stored.split(":");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function safeFilename(value: string) {
  return value.replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").slice(0, 180) || "document";
}

export function neutralizePromptInjection(value: string) {
  return value
    .replace(/<\/?(?:system|assistant|developer|tool|function)[^>]*>/gi, "[balise neutralisée]")
    .replace(/\b(ignore|oublie|disregard)\b.{0,40}\b(instructions?|consignes?|prompt)\b/gi, "[instruction potentiellement malveillante neutralisée]")
    .slice(0, 20_000);
}

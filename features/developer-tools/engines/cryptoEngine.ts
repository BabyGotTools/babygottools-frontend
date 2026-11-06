/**
 * Crypto engines: AES-256-GCM text envelope, CSPRNG token generator,
 * UUID v4/v7 and NanoID. All randomness comes from crypto.getRandomValues();
 * Math.random() is never used.
 */

import { encodeBase64Bytes, decodeBase64Bytes } from "./encoders";

const ITERATIONS = 600_000;
const ENVELOPE_VERSION = "BGT1";

export interface EnvelopeParts {
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

function webcrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c) throw new Error("Web Crypto API is unavailable in this environment.");
  return c;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const c = webcrypto();
  const base = await c.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return c.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(plaintext: string, password: string): Promise<EnvelopeParts> {
  if (password.length === 0) throw new Error("Enter a password — empty keys are refused.");
  const c = webcrypto();
  const salt = c.getRandomValues(new Uint8Array(16));
  const iv = c.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = await c.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as BufferSource
  );
  return { salt, iv, ciphertext: new Uint8Array(ct) };
}

/** Portable envelope string: BGT1.<salt b64>.<iv b64>.<ciphertext b64> */
export function toEnvelopeString(parts: EnvelopeParts): string {
  return [
    ENVELOPE_VERSION,
    encodeBase64Bytes(parts.salt),
    encodeBase64Bytes(parts.iv),
    encodeBase64Bytes(parts.ciphertext),
  ].join(".");
}

export function parseEnvelopeString(
  envelope: string
): { ok: true; salt: Uint8Array; iv: Uint8Array; ciphertext: Uint8Array } | { ok: false; error: string } {
  const parts = envelope.trim().split(".");
  if (parts.length !== 4) {
    return {
      ok: false,
      error: `Encrypted payload must be in ${ENVELOPE_VERSION}.salt.iv.ciphertext form — 4 dot-separated segments expected, got ${parts.length}.`,
    };
  }
  const [version, saltStr, ivStr, ctStr] = parts as [string, string, string, string];
  if (version !== ENVELOPE_VERSION) {
    return { ok: false, error: `Unknown payload version "${version}" — expected ${ENVELOPE_VERSION}.` };
  }
  const salt = decodeBase64Bytes(saltStr);
  const iv = decodeBase64Bytes(ivStr);
  const ct = decodeBase64Bytes(ctStr);
  if (!salt.ok || !iv.ok || !ct.ok) {
    return { ok: false, error: "Envelope segments are not valid Base64." };
  }
  if (salt.bytes.length === 0 || iv.bytes.length === 0 || ct.bytes.length === 0) {
    return { ok: false, error: "Envelope segments are empty or malformed." };
  }
  return { ok: true, salt: salt.bytes, iv: iv.bytes, ciphertext: ct.bytes };
}

export async function decryptText(
  salt: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  password: string
): Promise<string> {
  const c = webcrypto();
  const key = await deriveKey(password, salt);
  try {
    const plain = await c.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("Decryption failed — the password is incorrect or the payload was corrupted.");
  }
}

/* ----------------------------- token generator ---------------------------- */

export type TokenFormat = "hex" | "base64url" | "alphanumeric";

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomInts(count: number): Uint32Array {
  return webcrypto().getRandomValues(new Uint32Array(count));
}

function hexToken(lengthInBytes: number): string {
  let out = "";
  const chunk = 8;
  while (out.length < lengthInBytes * 2) {
    const ints = randomInts(Math.min(chunk, lengthInBytes - out.length / 2));
    for (const n of ints) out += n.toString(16).padStart(8, "0");
  }
  return out.slice(0, lengthInBytes * 2);
}

function base64UrlToken(lengthInBytes: number): string {
  const bytes = new Uint8Array(lengthInBytes);
  webcrypto().getRandomValues(bytes);
  return encodeBase64Bytes(bytes, true, true);
}

/**
 * Alphanumeric token via rejection sampling over the uint32 space —
 * every character is drawn with exactly equal probability (no modulo bias).
 */
function alnumToken(length: number): string {
  const reject = Math.floor(0x100000000 / ALNUM.length) * ALNUM.length;
  const out: string[] = [];
  while (out.length < length) {
    const ints = randomInts(Math.max(16, length - out.length));
    for (const n of ints) {
      if (n < reject) {
        out.push(ALNUM[n % ALNUM.length]!);
        if (out.length === length) break;
      }
    }
  }
  return out.join("");
}

export function generateToken(format: TokenFormat, length: number): string {
  if (format === "hex") return hexToken(Math.ceil(length / 2));
  if (format === "base64url") return base64UrlToken(length);
  return alnumToken(length);
}

/* ------------------------------- UUID engines ----------------------------- */

export function uuidV4(): string {
  const c = webcrypto();
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** RFC 9562 UUID v7 — 48-bit millisecond timestamp + cryptographic random tail. */
export function uuidV7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  const ts = BigInt(Math.max(0, Math.floor(now)));
  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);
  webcrypto().getRandomValues(bytes.subarray(6));
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Decode the embedded millisecond timestamp of a UUID v7. */
export function uuidV7Timestamp(id: string): Date | null {
  const clean = id.replace(/-/g, "");
  if (clean.length < 12 || !/^[0-9a-f]+$/i.test(clean.slice(0, 12))) return null;
  const d = new Date(parseInt(clean.slice(0, 12), 16));
  return Number.isNaN(d.getTime()) ? null : d;
}

const NANOID_ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

export function nanoId(length = 21): string {
  const bytes = webcrypto().getRandomValues(new Uint8Array(length));
  let out = "";
  const mask = 63; // alphabet size is 64 → modulo by bitmask is bias-free
  for (const b of bytes) out += NANOID_ALPHABET[b & mask]!;
  return out;
}

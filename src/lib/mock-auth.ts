import "server-only";

import { cookies } from "next/headers";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Dummy auth. Only used when Supabase keys are absent (the AuthForm falls
 * back to this). Everything lives in-memory on the server and in a signed
 * cookie — no database, no SMS. The OTP is also returned to the client so
 * the UI can display it (there is no real SMS channel).
 */

const COOKIE = "thirtyml_mock_session";
const SECRET = process.env.MOCK_AUTH_SECRET ?? "thirtyml-mock-auth-dev-secret";
const OTP_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_S = 60 * 60 * 24 * 7;

type Entry = { otp: string; mode: "login" | "signup"; expires: number };

// Dev-only in-memory store. Lives on the server process; good enough for
// a dummy flow. A real deployment would use Redis or the SMS provider.
const g = globalThis as unknown as { __mockOtp?: Map<string, Entry> };
const store: Map<string, Entry> = (g.__mockOtp ??= new Map());

function hmac(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function sign(phone: string) {
  const issued = Date.now();
  const payload = `${phone}.${issued}`;
  return `${payload}.${hmac(payload)}`;
}

function verify(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [phone, issued, sig] = parts;
  const expected = hmac(`${phone}.${issued}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() - Number(issued) > SESSION_TTL_S * 1000) return null;
  return phone;
}

export function generateOtp(phone: string, mode: "login" | "signup"): string {
  // Dev convenience: a stable code when MOCK_AUTH_FIXED_OTP is set.
  const fixed = process.env.MOCK_AUTH_FIXED_OTP;
  const otp = fixed && /^\d{6}$/.test(fixed)
    ? fixed
    : String(randomInt(0, 1_000_000)).padStart(6, "0");
  store.set(phone, { otp, mode, expires: Date.now() + OTP_TTL_MS });
  return otp;
}

export function consumeOtp(phone: string, otp: string): boolean {
  const entry = store.get(phone);
  if (!entry) return false;
  if (entry.expires < Date.now()) {
    store.delete(phone);
    return false;
  }
  if (entry.otp !== otp) return false;
  store.delete(phone);
  return true;
}

export async function setMockSession(phone: string) {
  const jar = await cookies();
  jar.set(COOKIE, sign(phone), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function clearMockSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getMockUser(): Promise<{ phone: string } | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const phone = verify(raw);
  return phone ? { phone } : null;
}

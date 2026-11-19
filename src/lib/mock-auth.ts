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

export type MockUser = {
  v: 1;
  /** Verified contact — exactly one of these is set. */
  phone?: string;
  email?: string;
  /** Profile (filled in during signup). */
  fullName?: string;
  dateOfBirth?: string;
  city?: string;
  legalAge?: boolean;
  idVerified?: boolean;
  idVerifiedAt?: string;
  idProvider?: "demo-mock";
  createdAt: string;
};

type OtpEntry = { otp: string; mode: "login" | "signup"; expires: number };

// Dev-only in-memory store. Lives on the server process; good enough for
// a dummy flow. A real deployment would use Redis or the SMS provider.
const g = globalThis as unknown as { __mockOtp?: Map<string, OtpEntry> };
const store: Map<string, OtpEntry> = (g.__mockOtp ??= new Map());

function hmac(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function encode(user: MockUser) {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString(
    "base64url"
  );
  return `${payload}.${hmac(payload)}`;
}

function decode(token: string): MockUser | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    if (parsed?.v !== 1) return null;
    if (!parsed.createdAt) return null;
    if (Date.now() - Date.parse(parsed.createdAt) > SESSION_TTL_S * 1000) {
      return null;
    }
    return parsed as MockUser;
  } catch {
    return null;
  }
}

export function generateOtp(
  identifier: string,
  mode: "login" | "signup"
): string {
  const fixed = process.env.MOCK_AUTH_FIXED_OTP;
  const otp =
    fixed && /^\d{6}$/.test(fixed)
      ? fixed
      : String(randomInt(0, 1_000_000)).padStart(6, "0");
  store.set(identifier, { otp, mode, expires: Date.now() + OTP_TTL_MS });
  return otp;
}

export function consumeOtp(identifier: string, otp: string): boolean {
  const entry = store.get(identifier);
  if (!entry) return false;
  if (entry.expires < Date.now()) {
    store.delete(identifier);
    return false;
  }
  if (entry.otp !== otp) return false;
  store.delete(identifier);
  return true;
}

async function writeCookie(user: MockUser) {
  const jar = await cookies();
  jar.set(COOKIE, encode(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function setMockUser(
  contact: { phone?: string; email?: string }
): Promise<MockUser> {
  const user: MockUser = {
    v: 1,
    phone: contact.phone,
    email: contact.email,
    createdAt: new Date().toISOString(),
  };
  await writeCookie(user);
  return user;
}

export async function updateMockUser(
  patch: Partial<Omit<MockUser, "v" | "createdAt">>
): Promise<MockUser | null> {
  const current = await getMockUser();
  if (!current) return null;
  const next: MockUser = { ...current, ...patch };
  await writeCookie(next);
  return next;
}

export async function clearMockSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getMockUser(): Promise<MockUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  return decode(raw);
}

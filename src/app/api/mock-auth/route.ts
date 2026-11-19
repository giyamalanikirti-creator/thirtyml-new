import { NextResponse } from "next/server";
import { z } from "zod";
import {
  emailSchema,
  otpSchema,
  phoneSchema,
} from "@/lib/validation/auth";
import {
  clearMockSession,
  consumeOtp,
  generateOtp,
  setMockUser,
} from "@/lib/mock-auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Dummy auth endpoint. Disabled whenever Supabase is configured so it can't
 * be used to bypass the real auth once keys are present.
 *
 * POST body:
 *   { action: "send",   method: "phone"|"email", value, mode }
 *     → { ok, devOtp } (dev)
 *   { action: "verify", method: "phone"|"email", value, otp }
 *     → { ok, user }   (sets signed session cookie)
 *   { action: "logout" } → { ok }
 */

export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send"),
    method: z.enum(["phone", "email"]),
    value: z.string(),
    mode: z.enum(["login", "signup"]),
  }),
  z.object({
    action: z.literal("verify"),
    method: z.enum(["phone", "email"]),
    value: z.string(),
    otp: z.string(),
  }),
  z.object({ action: z.literal("logout") }),
]);

function normaliseContact(method: "phone" | "email", value: string) {
  if (method === "phone") {
    const parsed = phoneSchema.safeParse(value);
    return parsed.success
      ? { ok: true as const, id: parsed.data }
      : { ok: false as const, error: parsed.error.issues[0].message };
  }
  const parsed = emailSchema.safeParse(value);
  return parsed.success
    ? { ok: true as const, id: parsed.data }
    : { ok: false as const, error: parsed.error.issues[0].message };
}

export async function POST(req: Request) {
  if (isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Mock auth is disabled when Supabase is configured." },
      { status: 404 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }
  const body = parsed.data;

  if (body.action === "logout") {
    await clearMockSession();
    return NextResponse.json({ ok: true });
  }

  const contact = normaliseContact(body.method, body.value);
  if (!contact.ok) {
    return NextResponse.json({ error: contact.error }, { status: 400 });
  }

  if (body.action === "send") {
    const otp = generateOtp(contact.id, body.mode);
    console.info(`[mock-auth] OTP for ${contact.id}: ${otp} (${body.mode})`);
    return NextResponse.json({ ok: true, devOtp: otp });
  }

  const otp = otpSchema.safeParse(body.otp);
  if (!otp.success) {
    return NextResponse.json(
      { error: otp.error.issues[0].message },
      { status: 400 }
    );
  }
  if (!consumeOtp(contact.id, otp.data)) {
    return NextResponse.json(
      { error: "Invalid or expired code." },
      { status: 400 }
    );
  }
  const user = await setMockUser(
    body.method === "phone" ? { phone: contact.id } : { email: contact.id }
  );
  return NextResponse.json({ ok: true, user });
}

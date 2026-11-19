import { NextResponse } from "next/server";
import { z } from "zod";
import { phoneSchema, otpSchema } from "@/lib/validation/auth";
import {
  clearMockSession,
  consumeOtp,
  generateOtp,
  setMockSession,
} from "@/lib/mock-auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Dummy auth endpoint. Disabled whenever Supabase is configured so it can't
 * be used to bypass the real auth once keys are present.
 *
 * POST body:
 *   { action: "send",   phone, mode }  → { ok, devOtp } (dev)
 *   { action: "verify", phone, otp }   → { ok } (sets signed session cookie)
 *   { action: "logout" }               → { ok }
 */

export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send"),
    phone: z.string(),
    mode: z.enum(["login", "signup"]),
  }),
  z.object({
    action: z.literal("verify"),
    phone: z.string(),
    otp: z.string(),
  }),
  z.object({ action: z.literal("logout") }),
]);

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

  const phone = phoneSchema.safeParse(body.phone);
  if (!phone.success) {
    return NextResponse.json(
      { error: phone.error.issues[0].message },
      { status: 400 }
    );
  }

  if (body.action === "send") {
    const otp = generateOtp(phone.data, body.mode);
    console.info(`[mock-auth] OTP for ${phone.data}: ${otp} (${body.mode})`);
    // devOtp is returned so the UI can show it — there is no real SMS.
    return NextResponse.json({ ok: true, devOtp: otp });
  }

  // verify
  const otp = otpSchema.safeParse(body.otp);
  if (!otp.success) {
    return NextResponse.json(
      { error: otp.error.issues[0].message },
      { status: 400 }
    );
  }
  if (!consumeOtp(phone.data, otp.data)) {
    return NextResponse.json(
      { error: "Invalid or expired code." },
      { status: 400 }
    );
  }
  await setMockSession(phone.data);
  return NextResponse.json({ ok: true });
}

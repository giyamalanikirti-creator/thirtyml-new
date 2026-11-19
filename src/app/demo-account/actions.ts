"use server";

import { redirect } from "next/navigation";
import { clearDemoSession, demoContactSchema, setDemoSession } from "@/lib/demo-session";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCities } from "@/lib/data/catalog";
import { otpSchema, signupDetailsSchema } from "@/lib/validation/auth";

const demoCode = "123456";

export async function requestDemoCode(input: unknown) {
  if (isSupabaseConfigured()) return { error: "Demo sign-in is unavailable." };
  const parsed = demoContactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return { code: demoCode };
}

export async function verifyDemoCode(input: unknown, code: string, signup?: unknown) {
  if (isSupabaseConfigured()) return { error: "Demo sign-in is unavailable." };
  const parsed = demoContactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const otp = otpSchema.safeParse(code);
  if (!otp.success) return { error: otp.error.issues[0].message };
  if (otp.data !== demoCode) return { error: "That code doesn’t match. Try the demo code shown above." };
  if (signup !== undefined) {
    const details = signupDetailsSchema.safeParse(signup);
    if (!details.success) return { error: details.error.issues[0].message };
    if (!(await getCities()).some(({ slug }) => slug === details.data.homeCity)) {
      return { error: "Pick your city." };
    }
    await setDemoSession({ ...parsed.data, details: details.data });
  } else {
    await setDemoSession(parsed.data);
  }
  return { ok: true };
}

export async function signOutOfDemo() {
  await clearDemoSession();
  redirect("/login");
}

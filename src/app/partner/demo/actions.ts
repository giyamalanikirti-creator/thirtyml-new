"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { todayIst } from "@/lib/data/catalog";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  clubCredentials, clubRegistration, demoBookings, loginDemoClub,
  logoutDemoClub, registerDemoClub, requireDemoClub, writeDemoActivity,
} from "@/lib/partner/demo";
import { sampleClubCredentials } from "@/lib/partner/sample-credentials";
import { nightSettingsSchema, validNight } from "@/lib/partner/night";

export async function demoClubAccess(mode: "signup" | "login", input: unknown) {
  if (isSupabaseConfigured()) return { error: "Demo club access is unavailable." };
  if (mode === "signup") {
    const parsed = clubRegistration.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    if (parsed.data.email === sampleClubCredentials.email && parsed.data.password === sampleClubCredentials.password) {
      return { error: "These credentials belong to the sample club. Use them on Partner login." };
    }
    if (!(await registerDemoClub(parsed.data))) return { error: "This browser already has a demo club. Sign in with its credentials." };
  } else {
    const parsed = clubCredentials.safeParse(input);
    if (!parsed.success) return { error: "Enter a valid email and your password." };
    if (!(await loginDemoClub(parsed.data.email, parsed.data.password))) return { error: "Email or password doesn’t match this browser’s demo club." };
  }
  return { error: null };
}

export async function saveDemoNight(input: unknown) {
  const { activity } = await requireDemoClub();
  const parsed = nightSettingsSchema.safeParse(input);
  if (!parsed.success || validNight(parsed.data.date, todayIst()) !== parsed.data.date) {
    return { error: "Check the nightly settings and try again." };
  }
  const settings = parsed.data;
  const keys = Object.keys(settings.section === "cover" ? settings.price : settings.capacity);
  if (keys.some((key) => key !== "single" && key !== "couple")) return { error: "Unknown demo ticket." };
  activity.settings = [settings, ...activity.settings.filter((item) =>
    item.date !== settings.date || item.section !== settings.section)].slice(0, 12);
  await writeDemoActivity(activity);
  revalidatePath("/partner/demo", "layout");
  return { error: null };
}

export async function admitDemoBooking(code: string) {
  const { activity } = await requireDemoClub();
  if (demoBookings.some((booking) => booking.code === code) && !activity.admitted.includes(code)) {
    activity.admitted.push(code);
    await writeDemoActivity(activity);
  }
  revalidatePath("/partner/demo", "layout");
}

export async function signOutDemoClub() {
  await requireDemoClub();
  await logoutDemoClub();
  redirect("/partner/login");
}

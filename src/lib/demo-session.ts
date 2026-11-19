import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { emailSchema, phoneSchema } from "@/lib/validation/auth";

const cookieName = "tml_demo_session";

// This browser-local profile is only for the demo UI. Real authentication
// and protected data continue to require a Supabase session.
export const demoContactSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("phone"), contact: phoneSchema }),
  z.object({ method: z.literal("email"), contact: emailSchema.max(254) }),
]);

export type DemoContact = z.infer<typeof demoContactSchema>;

export async function getDemoSession(): Promise<DemoContact | null> {
  if (isSupabaseConfigured()) return null;
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  try {
    const parsed = demoContactSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function setDemoSession(contact: DemoContact) {
  if (isSupabaseConfigured()) return;
  (await cookies()).set(cookieName, JSON.stringify(contact), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 86400,
  });
}

export async function clearDemoSession() {
  if (!isSupabaseConfigured()) (await cookies()).delete(cookieName);
}

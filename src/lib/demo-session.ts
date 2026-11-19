import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { emailSchema, phoneSchema, signupDetailsSchema } from "@/lib/validation/auth";

const cookieName = "tml_demo_session";

// This browser-local profile is only for the demo UI. Real authentication
// and protected data continue to require a Supabase session.
export const demoContactSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("phone"), contact: phoneSchema }),
  z.object({ method: z.literal("email"), contact: emailSchema.max(254) }),
]);

const demoSessionSchema = z.intersection(
  demoContactSchema,
  z.object({ details: signupDetailsSchema.optional() })
);

type DemoSession = z.infer<typeof demoSessionSchema>;

export async function getDemoSession(): Promise<DemoSession | null> {
  if (isSupabaseConfigured()) return null;
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  try {
    const parsed = demoSessionSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function setDemoSession(contact: DemoSession) {
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

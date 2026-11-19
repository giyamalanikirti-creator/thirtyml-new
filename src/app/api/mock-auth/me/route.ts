import { NextResponse } from "next/server";
import { getMockUser } from "@/lib/mock-auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/mock-auth/me → { user } | { user: null } (404 if real auth on). */
export async function GET() {
  if (isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const user = await getMockUser();
  return NextResponse.json({ user });
}

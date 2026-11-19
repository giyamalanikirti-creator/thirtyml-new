import { NextResponse } from "next/server";
import { z } from "zod";
import { todayIst } from "@/lib/data/catalog";
import { shiftDate } from "@/lib/partner/night";
import { isSupabaseConfigured, supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { allow } from "@/lib/rate-limit";

const signalSchema = z.object({ clubId: z.uuid(), date: z.iso.date(), visitKey: z.uuid() });

export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response(null, { status: 204 });
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
  const parsed = signalSchema.safeParse(await request.json().catch(() => null));
  const today = todayIst();
  if (!parsed.success || parsed.data.date < today || parsed.data.date > shiftDate(today, 60)) {
    return NextResponse.json({ error: "Invalid venue view" }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await allow("venue-intent", { limit: 90, window: "10 m" }, ip))) {
    return new Response(null, { status: 429 });
  }
  const db = supabaseAdmin();
  const { clubId, date, visitKey } = parsed.data;
  const { data: club } = await db.from("clubs").select("id").eq("id", clubId).eq("status", "approved").maybeSingle();
  if (!club) return new Response(null, { status: 204 });
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  const { error } = await db.from("venue_intent").upsert({
    club_id: clubId, on_date: date, visit_key: visitKey, user_id: user?.id ?? null,
  }, { onConflict: "club_id,on_date,visit_key", ignoreDuplicates: true });
  return new Response(null, { status: error ? 503 : 204 });
}

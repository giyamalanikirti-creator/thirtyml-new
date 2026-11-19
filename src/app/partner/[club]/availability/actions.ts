"use server";

import { revalidatePath } from "next/cache";
import { requirePartnerClub } from "@/lib/partner/current";
import { supabaseAdmin } from "@/lib/supabase/server";
import { todayIst } from "@/lib/data/catalog";
import { nightSettingsSchema, validNight } from "@/lib/partner/night";

export async function saveNight(clubSlug: string, input: unknown) {
  const ctx = await requirePartnerClub(clubSlug, ["owner", "manager"]);
  const parsed = nightSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the nightly settings and try again." };
  const settings = parsed.data;
  if (validNight(settings.date, todayIst()) !== settings.date) return { error: "Select a night within the next 60 days." };
  const { error } = await supabaseAdmin().rpc("update_night_operations", {
    p_club_id: ctx.club.id,
    p_date: settings.date,
    p_open: settings.section === "availability" ? settings.open : null,
    p_occupancy: settings.section === "availability" ? settings.occupancy : null,
    p_capacity: settings.section === "availability" ? settings.capacity : null,
    p_price: settings.section === "cover" ? settings.price : {},
    p_actor: ctx.userId,
  });
  if (error) return { error: "Couldn’t save the night. Refresh the ticket list and try again." };
  revalidatePath(`/partner/${clubSlug}`, "layout");
  revalidatePath("/[city]/clubs/[slug]", "page");
  return { error: null };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function markApplication(
  id: string,
  status: "approved" | "rejected" | "needs_info"
) {
  const { userId } = await requireAdmin();
  const admin = supabaseAdmin();
  if (status === "approved") {
    const result = await admin.rpc("approve_partner_application", { p_application: id, p_actor: userId });
    if (result.error) throw new Error(result.error.message);
    revalidatePath("/admin/applications");
    revalidatePath("/partner");
    return;
  }
  const { error } = await admin.from("partner_applications").update({ status })
    .eq("id", id).is("approved_club_id", null);
  if (error) throw new Error(error.message);
  await admin.from("audit_logs").insert({
    actor_id: userId,
    action: `application.${status}`,
    entity_type: "partner_application",
    entity_id: id,
  });
  revalidatePath("/admin/applications");
}

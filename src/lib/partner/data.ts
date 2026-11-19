import "server-only";

import { nightOperations } from "./operations";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Tonight-at-a-glance for a club. */
export async function clubOverview(clubId: string, date: string) {
  const admin = supabaseAdmin();
  const [night, bookingsResult, salesResult, ratingsResult] =
    await Promise.all([
      nightOperations(clubId, date),
      admin
        .from("bookings")
        .select("order_id, status, guest_count, tickets(guests_admitted)")
        .eq("club_id", clubId)
        .eq("night_date", date).in("status", ["confirmed", "checked_in", "no_show"]),
      admin.from("order_items").select("order_id, product_id, quantity, unit_price")
        .eq("club_id", clubId).eq("night_date", date),
      admin.from("clubs").select("avg_rating, rating_count").eq("id", clubId).single(),
    ]);

  const failure = bookingsResult.error ?? salesResult.error ?? ratingsResult.error;
  if (failure) throw new Error(failure.message);
  const confirmed = bookingsResult.data ?? [];
  const confirmedOrderIds = new Set(confirmed.map((booking) => booking.order_id));
  const guestsExpected = confirmed.reduce((total, booking) => total + booking.guest_count, 0);
  const admitted = confirmed.reduce(
    (total, booking) => total + (booking.tickets?.[0]?.guests_admitted ?? 0), 0
  );
  let revenue = 0;
  const soldByProduct = new Map<string, number>();
  for (const item of salesResult.data ?? []) {
    if (!confirmedOrderIds.has(item.order_id)) continue;
    revenue += item.quantity * item.unit_price;
    soldByProduct.set(item.product_id, (soldByProduct.get(item.product_id) ?? 0) + item.quantity);
  }

  const capacityLines = night.tickets.filter((ticket) => ticket.type === "entry").map((ticket) => ({
    ...ticket,
    sold: soldByProduct.get(ticket.id) ?? 0,
  }));

  return {
    bookings: confirmed.length,
    orderCount: confirmedOrderIds.size,
    guestsExpected,
    guestsAdmitted: admitted,
    revenue,
    capacity: capacityLines,
    occupancy: night.occupancy,
    bookingsOpen: night.open,
    rating: ratingsResult.data?.avg_rating ?? null,
    ratingCount: ratingsResult.data?.rating_count ?? 0,
  };
}

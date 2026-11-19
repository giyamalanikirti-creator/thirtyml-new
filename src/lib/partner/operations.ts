import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import { forecastNight, type NightObservation } from "./forecast";
import { lastWeek, shiftDate } from "./night";

const admissionHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23",
});

function slotOf(timestamp: string) {
  const hour = Number(admissionHour.format(new Date(timestamp)));
  return hour < 6 ? 2 : hour < 22 ? 0 : 1;
}

export async function nightOperations(clubId: string, date: string) {
  const db = supabaseAdmin();
  const [products, night, operations] = await Promise.all([
    db.from("products").select("id, name, base_price, capacity_per_night, type")
      .eq("club_id", clubId).eq("is_active", true).order("sort_order"),
    db.from("nights").select("is_open").eq("club_id", clubId).eq("on_date", date).maybeSingle(),
    db.from("night_operations").select("occupancy, capacity")
      .eq("club_id", clubId).eq("on_date", date).maybeSingle(),
  ]);
  const failure = products.error ?? night.error ?? operations.error;
  if (failure) throw new Error(failure.message);
  const entries = products.data ?? [];
  const prices = entries.length ? await db.rpc("catalog_prices", {
    p_product_ids: entries.map(({ id }) => id), p_date: date,
  }) : { data: [], error: null };
  if (prices.error) throw new Error(prices.error.message);
  const computed = new Map((prices.data ?? []).map((value) => [value.product_id, value]));
  const capacity = operations.data?.capacity;
  return {
    open: night.data?.is_open ?? true,
    occupancy: operations.data?.occupancy ?? 0,
    tickets: entries.map((product) => {
      const override = capacity && typeof capacity === "object" && !Array.isArray(capacity)
        ? capacity[product.id] : undefined;
      return {
        id: product.id, name: product.name, type: product.type,
        price: computed.get(product.id)?.price ?? product.base_price,
        available: computed.get(product.id)?.available ?? 0,
        priceUpdatedAt: computed.get(product.id)?.price_updated_at ?? null,
        capacity: typeof override === "number" ? override : product.capacity_per_night,
      };
    }),
  };
}

export async function weeklyEarnings(clubId: string, today: string) {
  const { start, end } = lastWeek(today);
  const db = supabaseAdmin();
  const [result, bookings, items] = await Promise.all([
    db.from("payouts").select("net, status")
      .eq("club_id", clubId).gte("night_date", start).lte("night_date", end),
    db.from("bookings").select("order_id, night_date")
      .eq("club_id", clubId).gte("night_date", start).lte("night_date", end)
      .in("status", ["confirmed", "checked_in", "no_show"]),
    db.from("order_items").select("order_id, night_date, quantity, unit_price")
      .eq("club_id", clubId).gte("night_date", start).lte("night_date", end),
  ]);
  const failure = result.error ?? bookings.error ?? items.error;
  if (failure) throw new Error(failure.message);
  const rows = result.data ?? [];
  const active = new Set((bookings.data ?? []).map((booking) => `${booking.order_id}:${booking.night_date}`));
  const booked = (items.data ?? []).reduce((sum, item) =>
    active.has(`${item.order_id}:${item.night_date}`) ? sum + item.quantity * item.unit_price : sum, 0);
  return {
    start, end, booked,
    net: rows.reduce((sum, row) => sum + row.net, 0),
    paid: rows.filter((row) => row.status === "processed").reduce((sum, row) => sum + row.net, 0),
    recorded: rows.length,
  };
}

async function readPages<T>(fetchPage: (
  from: number, to: number
) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const size = 500;
  const rows: T[] = [];
  for (let offset = 0; ; offset += size) {
    const { data, error } = await fetchPage(offset, offset + size - 1);
    if (error) throw new Error(error.message);
    if (data) rows.push(...data);
    if (!data || data.length < size) return rows;
  }
}

export async function clubForecast(clubId: string, date: string, today: string) {
  const db = supabaseAdmin();
  const start = shiftDate(today, -84);
  const [operations, bookings, events, views, offers, nights] = await Promise.all([
    nightOperations(clubId, date),
    readPages((from, to) => db.from("bookings")
      .select("night_date, guest_count, created_at, user_id, orders(created_at, coupon_id), tickets(guests_admitted, check_ins(at, guests_admitted))")
      .eq("club_id", clubId).in("status", ["confirmed", "checked_in", "no_show"])
      .gte("night_date", start).lte("night_date", date).order("night_date").order("id")
      .range(from, to)),
    db.from("events").select("starts_at").eq("club_id", clubId).eq("status", "published")
      .gte("starts_at", `${start}T00:00:00+05:30`).lt("starts_at", `${shiftDate(date, 1)}T00:00:00+05:30`),
    readPages((from, to) => db.from("venue_intent").select("on_date, user_id, viewed_at").eq("club_id", clubId)
      .gte("on_date", start).lte("on_date", date).order("on_date").order("visit_key").range(from, to)),
    db.from("coupons").select("valid_from, valid_until").eq("club_id", clubId)
      .not("valid_from", "is", null).not("valid_until", "is", null),
    db.from("nights").select("on_date").eq("club_id", clubId).eq("is_open", true)
      .gte("on_date", start).lt("on_date", today),
  ]);
  const failure = events.error ?? offers.error ?? nights.error;
  if (failure) throw new Error(failure.message);
  const ist = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
  const eventDates = new Set((events.data ?? []).map(({ starts_at }) => ist.format(new Date(starts_at))));
  const intentCounts = new Map<string, number>();
  const linked = new Map<string, string>();
  for (const view of views) {
    intentCounts.set(view.on_date, (intentCounts.get(view.on_date) ?? 0) + 1);
    if (view.user_id && view.on_date < today) {
      const key = `${view.on_date}:${view.user_id}`;
      if (!linked.has(key) || view.viewed_at < linked.get(key)!) linked.set(key, view.viewed_at);
    }
  }
  const observations = new Map<string, NightObservation>();
  function observationFor(day: string) {
    const existing = observations.get(day);
    if (existing) return existing;
    const night = `${day}T21:00:00+05:30`;
    const observation: NightObservation = {
      date: day, bookings: 0, guests: 0, admitted: 0, intent: intentCounts.get(day) ?? 0,
      event: eventDates.has(day), leadHours: [], arrivalSlots: [0, 0, 0], bookingSlots: [0, 0, 0],
      confirmationMinutes: [], offerBookings: 0,
      promotionActive: (offers.data ?? []).some((offer) => offer.valid_from && offer.valid_until &&
        Date.parse(offer.valid_from) <= Date.parse(night) && Date.parse(offer.valid_until) >= Date.parse(night)),
    };
    observations.set(day, observation);
    return observation;
  }
  for (const night of nights.data ?? []) observationFor(night.on_date);
  const converted = new Set<string>();
  let bookingCount = 0;
  let bookedGuests = 0;
  for (const booking of bookings) {
    if (booking.night_date === date) {
      bookingCount++;
      bookedGuests += booking.guest_count;
    }
    if (booking.night_date >= today) continue;
    const day = booking.night_date;
    const observation = observationFor(day);
    observation.bookings++;
    observation.guests += booking.guest_count;
    if (booking.orders?.coupon_id) observation.offerBookings++;
    const key = `${day}:${booking.user_id}`;
    const viewed = linked.get(key);
    if (viewed && viewed < booking.created_at) converted.add(key);
    if (booking.orders?.created_at) {
      const ordered = Date.parse(booking.orders.created_at);
      observation.leadHours.push(Math.max(0, (Date.parse(`${day}T21:00:00+05:30`) - ordered) / 3_600_000));
      observation.confirmationMinutes.push(Math.max(0, (Date.parse(booking.created_at) - ordered) / 60_000));
    }
    let firstCheckIn: string | undefined;
    for (const ticket of booking.tickets ?? []) {
      observation.admitted += ticket.guests_admitted;
      for (const check of ticket.check_ins ?? []) {
        if (!firstCheckIn || check.at < firstCheckIn) firstCheckIn = check.at;
        observation.arrivalSlots[slotOf(check.at)] += check.guests_admitted;
      }
    }
    if (firstCheckIn && observation.bookingSlots) observation.bookingSlots[slotOf(firstCheckIn)]++;
  }
  return forecastNight({
    history: [...observations.values()], date, event: eventDates.has(date),
    intent: intentCounts.get(date) ?? 0, bookingCount, bookedGuests,
    hoursUntil: Math.max(0, (Date.parse(`${date}T21:00:00+05:30`) - Date.now()) / 3_600_000),
    remaining: operations.tickets.filter((ticket) => ticket.type === "entry").reduce((sum, ticket) => {
      const guestsPerTicket = /couple/i.test(ticket.name) ? 2 : /group of 4/i.test(ticket.name) ? 4 : 1;
      return sum + ticket.available * guestsPerTicket;
    }, 0),
    open: operations.open, linkedViewers: linked.size, convertedViewers: converted.size,
  });
}

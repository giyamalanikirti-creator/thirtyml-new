import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";
import { nightSettingsSchema, shiftDate } from "./night";
import { sampleClubCredentials } from "./sample-credentials";
import { forecastNight, type NightObservation } from "./forecast";

const accountKey = "tml_demo_club";
const sessionKey = "tml_demo_club_session";
const activityKey = "tml_demo_club_activity";
const sampleSession = "sample-club";
const sampleActivityKey = "tml_sample_club_activity";
const cookieOptions = {
  httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 86400,
};

export const clubCredentials = z.object({ email: emailSchema.max(254), password: passwordSchema });
export const clubRegistration = clubCredentials.extend({
  name: z.string().trim().min(2, "Enter your club name.").max(80),
  city: z.string().trim().min(2, "Enter your city.").max(60),
});
const accountSchema = z.object({
  email: emailSchema.max(254), name: z.string().max(80), city: z.string().max(60),
  salt: z.string().regex(/^[a-f0-9]{32}$/), hash: z.string().regex(/^[a-f0-9]{64}$/),
});
const activitySchema = z.object({
  settings: z.array(nightSettingsSchema).max(12), admitted: z.array(z.string()).max(3),
});

type Account = z.infer<typeof accountSchema>;
type Activity = z.infer<typeof activitySchema>;

function readCookie<T>(value: string | undefined, schema: z.ZodType<T>) {
  try {
    const parsed = schema.safeParse(JSON.parse(value ?? "null"));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export async function registerDemoClub(input: z.infer<typeof clubRegistration>) {
  const store = await cookies();
  if (store.has(accountKey)) return false;
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(input.password, salt, 32).toString("hex");
  const account = { email: input.email, name: input.name, city: input.city, salt, hash };
  store.set(accountKey, JSON.stringify(account), cookieOptions);
  startSession(store, account);
  return true;
}

function startSession(store: Awaited<ReturnType<typeof cookies>>, account: Account) {
  const token = createHash("sha256").update(account.hash + account.salt).digest("hex");
  store.set(sessionKey, token, { ...cookieOptions, maxAge: 86400 });
}

export async function loginDemoClub(email: string, password: string) {
  const store = await cookies();
  if (email === sampleClubCredentials.email && password === sampleClubCredentials.password) {
    store.set(sessionKey, sampleSession, { ...cookieOptions, maxAge: 86400 });
    return true;
  }
  const account = readCookie(store.get(accountKey)?.value, accountSchema);
  if (!account || account.email !== email) return false;
  const expected = Buffer.from(account.hash, "hex");
  if (!timingSafeEqual(expected, scryptSync(password, account.salt, 32))) return false;
  startSession(store, account);
  return true;
}

export async function requireDemoClub() {
  if (isSupabaseConfigured()) redirect("/partner");
  const store = await cookies();
  const account = readCookie(store.get(accountKey)?.value, accountSchema);
  const token = store.get(sessionKey)?.value;
  if (token === sampleSession) {
    const activity = readCookie(store.get(sampleActivityKey)?.value, activitySchema) ?? { settings: [], admitted: [] };
    return { name: "ThirtyML Sample Club", city: "Mumbai", activity };
  }
  if (!account || !token || token !== createHash("sha256").update(account.hash + account.salt).digest("hex")) {
    redirect("/partner/login");
  }
  const activity = readCookie(store.get(activityKey)?.value, activitySchema) ?? { settings: [], admitted: [] };
  return { name: account.name, city: account.city, activity };
}

export async function writeDemoActivity(activity: Activity) {
  const store = await cookies();
  const key = store.get(sessionKey)?.value === sampleSession ? sampleActivityKey : activityKey;
  store.set(key, JSON.stringify(activity), cookieOptions);
}

export async function logoutDemoClub() {
  (await cookies()).delete(sessionKey);
}

export const demoBookings = [
  { code: "DEMO-104", guest: "Anika", guests: 2 },
  { code: "DEMO-105", guest: "Dev", guests: 4 },
  { code: "DEMO-106", guest: "Meera", guests: 2 },
];

export function demoNight(activity: Activity, date: string, today: string) {
  const availability = activity.settings.filter((item) => item.section === "availability").find((item) => item.date === date);
  const cover = activity.settings.filter((item) => item.section === "cover").find((item) => item.date === date);
  const open = availability?.open ?? true;
  const tickets = [
    { id: "single", name: "Single entry", price: 150000, capacity: 60, reserved: 0 },
    { id: "couple", name: "Couple entry", price: 240000, capacity: 30, reserved: 4 },
  ].map((ticket) => {
    const capacity = availability?.capacity[ticket.id] ?? ticket.capacity;
    const reserved = date === today ? ticket.reserved : 0;
    return { ...ticket, type: "entry", capacity, price: cover?.price[ticket.id] ?? ticket.price,
      available: open ? Math.max(0, capacity - reserved) : 0 };
  });
  return { open, occupancy: availability?.occupancy ?? 0, tickets };
}

export function demoForecast(activity: Activity, date: string, today: string) {
  const operations = demoNight(activity, date, today);
  const history: NightObservation[] = Array.from({ length: 35 }, (_, i) => {
    const historicalDate = shiftDate(today, i - 35);
    const bookings = 17 + (i * 7 % 21);
    return {
      date: historicalDate, bookings, guests: bookings * 2, admitted: Math.round(bookings * 1.7),
      intent: bookings * 4, event: i % 5 === 0, leadHours: [6 + i % 20], confirmationMinutes: [0.5 + i % 3],
      arrivalSlots: [Math.round(bookings * 0.35), bookings, Math.round(bookings * 0.35)],
      bookingSlots: [4, Math.max(0, bookings - 8), 4],
      offerBookings: i % 5 === 1 ? 8 : 0, promotionActive: i % 5 === 1,
    };
  });
  return forecastNight({
    history, date, event: false, intent: date === today ? 97 : 42,
    bookingCount: date === today ? demoBookings.length : 0,
    bookedGuests: date === today ? demoBookings.reduce((sum, booking) => sum + booking.guests, 0) : 0,
    remaining: operations.tickets.reduce((sum, ticket) => sum + ticket.available, 0),
    open: operations.open, linkedViewers: 420, convertedViewers: 86,
  });
}

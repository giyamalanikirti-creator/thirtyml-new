import { z } from "zod";

export const nightSettingsSchema = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("availability"),
    date: z.iso.date(),
    open: z.boolean(),
    occupancy: z.number().int().min(0).max(10000),
    capacity: z.record(z.string(), z.number().int().min(0).max(10000)),
  }),
  z.object({
    section: z.literal("cover"),
    date: z.iso.date(),
    price: z.record(z.string(), z.number().int().min(0).max(100_000_000)),
  }),
]);

export type NightSettings = z.infer<typeof nightSettingsSchema>;
export type OpsSection = NightSettings["section"];

export function validNight(date: string | undefined, today: string) {
  return date && z.iso.date().safeParse(date).success && date >= today && date <= shiftDate(today, 60)
    ? date : today;
}

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function lastWeek(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const monday = shiftDate(date, -((weekday + 6) % 7));
  return { start: shiftDate(monday, -7), end: shiftDate(monday, -1) };
}

import { describe, expect, it } from "vitest";
import { forecastNight, type NightObservation } from "@/lib/partner/forecast";
import { lastWeek } from "@/lib/partner/night";

const observed = (date: string): NightObservation => ({
  date, bookings: 10, guests: 20, admitted: 16, event: false, intent: 30,
  leadHours: [12, 24], arrivalSlots: [4, 8, 4], bookingSlots: [2, 6, 2],
  confirmationMinutes: [1], offerBookings: 0,
});

const input = {
  date: "2026-11-20", event: false, intent: 30,
  bookedGuests: 16, bookingCount: 8, remaining: 2, open: true,
};

describe("partner forecast", () => {
  it("waits for enough comparable nights", () => {
    expect(forecastNight({ ...input, history: [observed("2026-11-13")] }).estimate).toBeNull();
  });

  it("forecasts both guests and bookings by window, and flags low inventory", () => {
    const history = ["2026-10-23", "2026-10-30", "2026-11-06", "2026-11-13"].map(observed);
    const result = forecastNight({ ...input, history });
    expect(result.estimate?.attendance).toBe(16);
    expect(result.estimate?.arrivalSlots?.reduce((sum, value) => sum + value, 0)).toBe(16);
    expect(result.estimate?.bookingSlots?.reduce((sum, value) => sum + value, 0)).toBe(10);
    expect(result.estimate?.recommendation).toContain("Sell-out");
    expect(result.metrics.meanError).toBe(0);
    expect(forecastNight({ ...input, history, open: false }).estimate?.recommendation).toContain("paused");
  });

  it("reports the preceding Monday–Sunday even on Monday", () => {
    expect(lastWeek("2026-11-23")).toEqual({ start: "2026-11-16", end: "2026-11-22" });
  });
});

import Link from "next/link";
import type { forecastNight } from "@/lib/partner/forecast";

const percentage = (value: number | null) => value === null ? "—" : `${Math.round(value * 100)}%`;
const rounded = (value: number | null, unit = "") => value === null ? "—" : `${Number(value.toFixed(1))}${unit}`;

export function ForecastPanel({ data, availability, promos }: {
  data: ReturnType<typeof forecastNight>;
  availability?: string;
  promos?: string;
}) {
  const { estimate, comparable, metrics } = data;
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-plum/35 bg-aubergine/40 p-5">
        <h2 className="font-display text-xl font-semibold">Demand forecast</h2>
        {estimate ? (
          <>
            <p className="mt-1 text-sm text-moon-dim">Based on {comparable} comparable nights, with event schedules, booking lead times, and browsing signals where available.</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm text-moon-dim">Expected bookings</dt><dd className="text-2xl font-bold">{estimate.bookings}</dd></div>
              <div><dt className="text-sm text-moon-dim">Expected attendance</dt><dd className="text-2xl font-bold">{estimate.attendance}</dd></div>
            </dl>
            {estimate.arrivalSlots && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="mb-3 text-sm font-medium">Expected arrivals by time (IST)</h3>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {["Before 10 pm", "10 pm – midnight", "After midnight"].map((slot, i) => (
                    <div key={slot}>
                      <p className="text-moon-dim">{slot}</p>
                      <p className="font-semibold">{estimate.arrivalSlots?.[i]} guests</p>
                      {estimate.bookingSlots && <p className="text-xs text-moon-dim">{estimate.bookingSlots[i]} bookings</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : <p className="mt-3 text-sm text-moon-dim">Forecasts need at least three comparable nights and booking activity. So far there are {comparable} comparable nights.</p>}
      </section>
      {estimate && (
        <section className="rounded-xl border border-line bg-night-raised p-5">
          <h2 className="font-display text-lg font-semibold">Suggested next step</h2>
          <p className="mt-2 text-sm">{estimate.recommendation}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {availability && <Link className="text-plum-bright underline" href={availability}>Review availability</Link>}
            {promos && <Link className="text-plum-bright underline" href={promos}>Review offers</Link>}
          </div>
          <p className="mt-3 text-xs text-moon-dim">Your team decides whether to publish changes.</p>
        </section>
      )}
      <section className="rounded-xl border border-line bg-night-raised p-5">
        <h2 className="font-display text-lg font-semibold">Recent outcomes</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[
            ["Discovery to booking", percentage(metrics.conversion)],
            ["Median confirmation", rounded(metrics.confirmation, " min")],
            ["Booked guests checked in", percentage(metrics.showRate)],
            ["Median booking lead time", rounded(metrics.leadTime, " hr")],
            ["Baseline attendance error", rounded(metrics.meanError, " guests")],
            ["Bookings with a promo", metrics.offerBookings],
            ["Observed offer lift", percentage(metrics.offerLift)],
          ].map(([label, value]) => (
            <div key={label}><dt className="text-xs text-moon-dim">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-moon-dim">Discovery conversion uses signed-in browsing with consent. Baseline error compares earlier comparable nights with actual check-ins across {metrics.forecastsEvaluated} test nights. Offer lift compares similar nights and can reflect other differences.</p>
      </section>
    </div>
  );
}

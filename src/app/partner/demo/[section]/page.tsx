import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EarningsCard } from "@/components/partner/earnings-card";
import { NightEditor, NightPicker } from "@/components/partner/night-editor";
import { ForecastPanel } from "@/components/partner/forecast-panel";
import { todayIst } from "@/lib/data/catalog";
import { demoBookings, demoForecast, demoNight, requireDemoClub } from "@/lib/partner/demo";
import { lastWeek, validNight } from "@/lib/partner/night";
import { formatPaise } from "@/lib/utils";
import { admitDemoBooking, saveDemoNight, signOutDemoClub } from "../actions";

const sections = {
  overview: "Dashboard", cover: "Cover charges", availability: "Nightly availability",
  forecast: "Demand forecast", bookings: "Bookings & check-in",
};
const base = "/partner/demo";

export default async function DemoWorkspace({ params, searchParams }: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (!Object.hasOwn(sections, section)) notFound();
  const { name, city, activity } = await requireDemoClub();
  const today = todayIst();
  const date = validNight(query.date, today);
  const night = demoNight(activity, date, today);
  const week = lastWeek(today);
  const admitted = demoBookings.filter((booking) => activity.admitted.includes(booking.code))
    .reduce((sum, booking) => sum + booking.guests, 0);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-plum-bright">Demo partner portal · {city}</p>
          <h1 className="mt-1 break-words font-display text-3xl font-bold">{name}</h1>
        </div>
        <form action={signOutDemoClub}><Button type="submit" variant="secondary">Sign out</Button></form>
      </header>
      <nav aria-label="Club workspace" className="flex gap-2 overflow-x-auto border-b border-line pb-3">
        {Object.entries(sections).map(([path, label]) => (
          <Link key={path} href={`${base}/${path}`} aria-current={section === path ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${section === path ? "bg-plum/25 text-moon" : "text-moon-dim hover:bg-night-raised"}`}>
            {label}
          </Link>
        ))}
      </nav>
      <h2 className="font-display text-xl font-semibold">{sections[section as keyof typeof sections]}</h2>
      {section === "overview" && (
        <>
          <EarningsCard earnings={{ ...week, net: 8_435_000, booked: 9_600_000, paid: 7_800_000, recorded: 4 }} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Sample bookings", demoBookings.length],
              ["Guests checked in", admitted],
              ["Door occupancy", night.occupancy],
              ["Online bookings", night.open ? "Open" : "Paused"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line bg-night-raised p-4">
                <p className="text-sm text-moon-dim">{label}</p><p className="mt-1 text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <section className="rounded-xl border border-line bg-night-raised p-5">
            <h3 className="font-display text-lg font-semibold">Tonight’s entry</h3>
            {night.tickets.map((ticket) => (
              <div key={ticket.id} className="mt-3 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm">
                <span>{ticket.name}</span><span>{formatPaise(ticket.price)} · {ticket.available} available</span>
              </div>
            ))}
          </section>
        </>
      )}
      {(section === "cover" || section === "availability") && (
        <div className="max-w-3xl space-y-5">
          <NightPicker key={date} date={date} today={today} />
          <NightEditor key={date} section={section} date={date} {...night} save={saveDemoNight} />
        </div>
      )}
      {section === "forecast" && (
        <div className="max-w-4xl space-y-5">
          <p className="text-sm text-moon-dim">Forecasts and outcomes below use sample transaction history.</p>
          <NightPicker key={date} date={date} today={today} />
          <ForecastPanel data={demoForecast(activity, date, today)} availability={`${base}/availability?date=${date}`} />
        </div>
      )}
      {section === "bookings" && (
        <section className="space-y-3">
          {demoBookings.map((booking) => {
            const checkedIn = activity.admitted.includes(booking.code);
            return (
              <div key={booking.code} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-night-raised p-4">
                <div><p className="font-medium">{booking.guest} · {booking.guests} guests</p><p className="text-sm text-moon-dim">{booking.code}</p></div>
                <form action={admitDemoBooking.bind(null, booking.code)}>
                  <Button type="submit" variant="secondary" disabled={checkedIn}>{checkedIn ? "Checked in" : "Check in group"}</Button>
                </form>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}

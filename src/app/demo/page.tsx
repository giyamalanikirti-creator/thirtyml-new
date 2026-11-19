import type { Metadata } from "next";
import { DemoEventCard } from "./demo-event-card";

export const metadata: Metadata = { title: "Demo — event" };

/** Static demo. Prices are integer paise, formatted via formatPaise. */
const demoEvent = {
  id: "demo-event-1",
  title: "Dusk Set · Agra Rooftop",
  club: "Thirty-One, Agra",
  night: "Sat 22 Nov, doors 9pm",
  pricePaise: 149900,
};

export default function DemoPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold">{demoEvent.title}</h1>
      <p className="mt-1 text-sm text-moon-dim">
        {demoEvent.club} · {demoEvent.night}
      </p>
      <DemoEventCard
        id={demoEvent.id}
        title={demoEvent.title}
        subtitle={`${demoEvent.club} · ${demoEvent.night}`}
        pricePaise={demoEvent.pricePaise}
      />
    </>
  );
}

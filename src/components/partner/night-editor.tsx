"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NightSettings, OpsSection } from "@/lib/partner/night";
import { shiftDate } from "@/lib/partner/night";

export type NightTicket = { id: string; name: string; price: number; capacity: number; available: number; type: string };

export function NightPicker({ date, today }: { date: string; today: string }) {
  return (
    <form className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm">
        Night
        <Input name="date" type="date" defaultValue={date} min={today} max={shiftDate(today, 60)} required />
      </label>
      <Button type="submit" variant="secondary">View night</Button>
    </form>
  );
}

export function NightEditor({
  section, date, open, occupancy, tickets, save,
}: {
  section: OpsSection;
  date: string;
  open: boolean;
  occupancy: number;
  tickets: NightTicket[];
  save: (settings: NightSettings) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [result, setResult] = useState<{ error: string | null }>();
  const isCover = section === "cover";
  const rows = isCover ? tickets.filter((ticket) => ticket.type === "entry") : tickets;

  return (
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const amounts = Object.fromEntries(rows.map(({ id }) => [
        id, Math.round(Number(form.get(id)) * (isCover ? 100 : 1)),
      ]));
      const settings: NightSettings = isCover
        ? { section, date, price: amounts }
        : { section, date, open: form.get("open") === "on", occupancy: Number(form.get("occupancy")), capacity: amounts };
      startTransition(async () => {
        try {
          const response = await save(settings);
          setResult(response);
          if (!response.error) router.refresh();
        } catch {
          setResult({ error: "Couldn’t save the night. Try again." });
        }
      });
    }}>
      <fieldset disabled={busy} className="space-y-4">
        {!isCover && (
          <div className="grid gap-4 rounded-lg border border-line bg-night-raised p-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input name="open" type="checkbox" defaultChecked={open} /> Accept new bookings
            </label>
            <label className="grid gap-1 text-sm">
              Guests currently inside
              <Input name="occupancy" type="number" min={0} max={10000} defaultValue={occupancy} required />
            </label>
            <p className="text-xs text-moon-dim sm:col-span-2">
              Door occupancy is a manual headcount. Online inventory limits are per ticket type and count existing reservations and holds.
            </p>
          </div>
        )}
        {rows.length === 0 && <p className="text-sm text-moon-dim">There are no active tickets to edit.</p>}
        {rows.map((ticket) => (
          <div key={ticket.id} className="grid gap-3 rounded-lg border border-line bg-night-raised p-4 sm:grid-cols-2 sm:items-center">
            <div>
              <p className="font-medium">{ticket.name}</p>
              <p className="text-sm text-moon-dim">{ticket.available} currently available</p>
            </div>
            <label className="grid gap-1 text-sm">
              {isCover ? "Cover charge (₹)" : "Online ticket limit"}
              <Input name={ticket.id} type="number" min={0} max={isCover ? 1_000_000 : 10000}
                step={isCover ? "0.01" : "1"} defaultValue={isCover ? ticket.price / 100 : ticket.capacity} required />
            </label>
          </div>
        ))}
        <Button type="submit" disabled={isCover && rows.length === 0}>{busy ? "Saving…" : isCover ? "Publish cover charges" : "Save nightly availability"}</Button>
      </fieldset>
      {result && <p role={result.error ? "alert" : "status"} className={result.error ? "text-danger" : "text-drop"}>{result.error ?? "Changes saved."}</p>}
    </form>
  );
}

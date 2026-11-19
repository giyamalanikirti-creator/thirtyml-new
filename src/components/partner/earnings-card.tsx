import Link from "next/link";
import { formatPaise } from "@/lib/utils";

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function EarningsCard({ earnings, href }: {
  earnings: { start: string; end: string; net: number; booked: number; paid: number; recorded: number };
  href?: string;
}) {
  const period = `${day.format(new Date(earnings.start))} – ${day.format(new Date(earnings.end))}`;
  return (
    <section className="rounded-xl border border-plum/35 bg-aubergine/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-moon-dim">ThirtyML earnings last week</h2>
          <p className="mt-2 font-display text-3xl font-bold tnum">{earnings.recorded ? formatPaise(earnings.net) : "No settlement yet"}</p>
          <p className="mt-1 text-sm text-moon-dim">{period}{earnings.recorded ? " · Net after recorded deductions" : ""}</p>
        </div>
        {href && <Link className="text-sm text-plum-bright underline" href={href}>View payouts</Link>}
      </div>
      <p className="mt-4 text-sm">
        {formatPaise(earnings.booked)} booked value · {formatPaise(earnings.paid)} settled
      </p>
    </section>
  );
}

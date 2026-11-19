import { todayIst } from "@/lib/data/catalog";
import { requirePartnerClub } from "@/lib/partner/current";
import { clubForecast } from "@/lib/partner/operations";
import { validNight } from "@/lib/partner/night";
import { ForecastPanel } from "@/components/partner/forecast-panel";
import { NightPicker } from "@/components/partner/night-editor";
import { PartnerShell } from "@/components/partner/shell";

export default async function ForecastPage({ params, searchParams }: {
  params: Promise<{ club: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ club }, query] = await Promise.all([params, searchParams]);
  const ctx = await requirePartnerClub(club, ["owner", "manager", "finance"]);
  const today = todayIst();
  const date = validNight(query.date, today);
  const data = await clubForecast(ctx.club.id, date, today);
  const canEdit = ctx.membership.role !== "finance";
  return (
    <PartnerShell ctx={ctx} section="/forecast">
      <div className="max-w-4xl space-y-5">
        <NightPicker key={date} date={date} today={today} />
        <ForecastPanel data={data}
          availability={canEdit ? `/partner/${club}/availability?date=${date}` : undefined}
          promos={canEdit ? `/partner/${club}/promo-codes` : undefined} />
      </div>
    </PartnerShell>
  );
}

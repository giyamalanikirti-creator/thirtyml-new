import { todayIst } from "@/lib/data/catalog";
import { requirePartnerClub } from "@/lib/partner/current";
import { nightOperations } from "@/lib/partner/operations";
import { validNight, type OpsSection } from "@/lib/partner/night";
import { PartnerShell } from "./shell";
import { NightEditor, NightPicker } from "./night-editor";
import { saveNight } from "@/app/partner/[club]/availability/actions";

export async function OperationsPage({ club, requestedDate, section }: {
  club: string; requestedDate?: string; section: OpsSection;
}) {
  const ctx = await requirePartnerClub(club, ["owner", "manager"]);
  const today = todayIst();
  const date = validNight(requestedDate, today);
  const operations = await nightOperations(ctx.club.id, date);
  return (
    <PartnerShell ctx={ctx} section={`/${section}`}>
      <div className="max-w-3xl space-y-5">
        <p className="text-sm text-moon-dim">{section === "cover"
          ? "Set entry cover charges for this night. Other dates keep their existing pricing."
          : "Update the door headcount, ticket limits and booking status for one night. Confirmed bookings are retained."}</p>
        <NightPicker key={date} date={date} today={today} />
        <NightEditor key={date} section={section} date={date} {...operations} save={saveNight.bind(null, club)} />
      </div>
    </PartnerShell>
  );
}

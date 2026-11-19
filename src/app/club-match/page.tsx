import Link from "next/link";
import { Header } from "@/components/shell/header";
import { ClubCard } from "@/components/catalog/club-card";
import { getCities, getMatchingEntryProducts, listClubs, todayIst } from "@/lib/data/catalog";
import { shiftDate } from "@/lib/partner/night";
import { formatPaise } from "@/lib/utils";

export default async function ClubMatch({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; date?: string; guests?: string; budget?: string; genre?: string }>;
}) {
  const query = await searchParams;
  const cities = await getCities();
  const city = cities.find((entry) => entry.slug === query.city) ?? cities[0];
  const today = todayIst();
  const lastDate = shiftDate(today, 30);
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) &&
    Number.isFinite(Date.parse(query.date)) && query.date >= today && query.date <= lastDate
    ? query.date : today;
  const guests = Math.min(20, Math.max(1, Math.floor(Number(query.guests) || 2)));
  const budget = Math.min(1_000_000, Math.max(0, Number(query.budget) || 0));
  const genre = query.genre?.trim().slice(0, 50) ?? "";
  const clubs = await listClubs({ city: city.slug, genre: genre || undefined });
  const products = await getMatchingEntryProducts(clubs, date);
  const matches = clubs.flatMap((club) => {
    const options = products.filter((product) => product.clubId === club.id && !/ladies/i.test(product.name)).flatMap((product) => {
      const partySize = /couple/i.test(product.name) ? 2 : /group of 4/i.test(product.name) ? 4 : 1;
      if (guests % partySize !== 0) return [];
      const units = guests / partySize;
      if (units > product.available || units > product.maxPerOrder) return [];
      return [{
        product: product.name, total: units * product.price,
        minimumAge: Math.max(club.minAge, product.minAge ?? 0),
      }];
    }).sort((a, b) => a.total - b.total);
    const best = options[0];
    return best && (!budget || best.total <= budget * 100) ? [{ club, ...best }] : [];
  }).sort((a, b) => a.total - b.total);

  return (
    <>
      <Header city={city.slug} />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
        <h1 className="font-display text-3xl font-semibold">Find a club for your group</h1>
        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-night-raised p-4">
          <label className="grid gap-1 text-sm">City<select name="city" defaultValue={city.slug} className="rounded border border-line bg-night p-2">{cities.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Night<input name="date" type="date" min={today} max={lastDate} defaultValue={date} className="rounded border border-line bg-night p-2" /></label>
          <label className="grid gap-1 text-sm">Guests<input name="guests" type="number" min={1} max={20} defaultValue={guests} className="w-20 rounded border border-line bg-night p-2" /></label>
          <label className="grid gap-1 text-sm">Group budget (₹)<input name="budget" type="number" min={0} placeholder="Any budget" defaultValue={budget || undefined} className="w-32 rounded border border-line bg-night p-2" /></label>
          <label className="grid gap-1 text-sm">Music genre<input name="genre" defaultValue={genre} placeholder="Any genre" className="w-32 rounded border border-line bg-night p-2" /></label>
          <button className="rounded bg-plum px-4 py-2 font-medium">Find matches</button>
        </form>
        <p className="text-sm text-moon-dim">Matches use current ticket availability and cover charges for the selected night. Checkout fees are separate.</p>
        {matches.length ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {matches.map(({ club, product, total, minimumAge }) => (
              <article key={club.id} className="space-y-2">
                <ClubCard club={{ ...club, minPrice: null, openTonight: true }} availableLabel="Available this night" night={date} />
                <Link className="block rounded-lg border border-line p-3 text-sm hover:border-plum-bright" href={`/${club.citySlug}/clubs/${club.slug}?date=${date}`}>
                  {product} · {formatPaise(total)} for the group · Ages {minimumAge}+ → Select this night
                </Link>
              </article>
            ))}
          </div>
        ) : <p className="rounded-lg border border-line p-5">No clubs match these filters. Try another night, genre, or budget.</p>}
      </main>
    </>
  );
}

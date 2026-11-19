import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/shell/header";
import { Footer } from "@/components/shell/footer";
import { ClubCard } from "@/components/catalog/club-card";
import { FiltersBar } from "@/components/catalog/filters-bar";
import { getCities, listClubs } from "@/lib/data/catalog";
import { DEFAULT_CITY } from "@/lib/cities";

export const metadata: Metadata = {
  title: "Explore clubs",
  description: "Every club on ThirtyML with live entry prices.",
};

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string;
    q?: string;
    genre?: string;
    maxPrice?: string;
    sort?: string;
    open?: string;
  }>;
}) {
  const sp = await searchParams;
  const cities = await getCities();
  const city =
    cities.find((c) => c.slug === sp.city)?.slug ??
    cities[0]?.slug ??
    DEFAULT_CITY;

  const clubs = await listClubs({
    city,
    q: sp.q,
    genre: sp.genre,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    openTonight: sp.open === "1",
    sort: (sp.sort as "popularity" | "price_asc" | "price_desc" | "rating") ?? "popularity",
  });

  return (
    <>
      <Header city={city} />
      <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-display text-2xl font-semibold">Explore clubs</h1>
        <div className="mt-4">
          <Suspense>
            <FiltersBar cities={cities} />
          </Suspense>
        </div>

        {clubs.length === 0 ? (
          <p className="mt-8 rounded-md border border-line bg-night-raised p-6 text-sm text-moon-dim">
            Nothing matches those filters. Try widening the price range or
            clearing the genre.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8">
            {clubs.map((club) => (
              <ClubCard key={club.id} club={club} wide />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

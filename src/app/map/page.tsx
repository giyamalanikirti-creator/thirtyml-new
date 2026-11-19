import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Header } from "@/components/shell/header";
import { getCities, listClubs } from "@/lib/data/catalog";
import { ClubMapLazy } from "@/components/map/club-map-lazy";
import { CITY_COOKIE, DEFAULT_CITY } from "@/lib/cities";

export const metadata: Metadata = {
  title: "Map",
  description: "Find club locations and directions, with live entry prices.",
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city: requestedCity } = await searchParams;
  const cookieStore = await cookies();
  const cities = await getCities();
  const city =
    cities.find((c) => c.slug === requestedCity)?.slug ??
    cities.find((c) => c.slug === cookieStore.get(CITY_COOKIE)?.value)?.slug ??
    cities[0]?.slug ??
    DEFAULT_CITY;
  const cityInfo = cities.find((c) => c.slug === city)!;
  const clubs = await listClubs({ city });

  const pins = clubs
    .filter((b) => b.lat !== null && b.lng !== null)
    .map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      citySlug: city,
      lat: b.lat!,
      lng: b.lng!,
      minPrice: b.minPrice,
    }));

  return (
    <>
      <Header city={city} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <h1 className="mb-4 font-display text-2xl font-semibold">
          Tonight on the map
        </h1>
        <ClubMapLazy
          pins={pins}
          center={[cityInfo.lat, cityInfo.lng]}
          zoom={12}
          height="clamp(320px, calc(100dvh - 200px), 730px)"
        />
      </main>
    </>
  );
}

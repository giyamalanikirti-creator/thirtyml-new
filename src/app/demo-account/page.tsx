import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCities } from "@/lib/data/catalog";
import { Header } from "@/components/shell/header";
import { getDemoSession } from "@/lib/demo-session";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { signOutOfDemo } from "./actions";

export default async function DemoAccountPage() {
  if (isSupabaseConfigured()) redirect("/account");
  const session = await getDemoSession();
  if (!session) redirect("/login");

  const city = session.details
    ? (await getCities()).find(({ slug }) => slug === session.details?.homeCity)
    : null;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <h1 className="font-display text-2xl font-semibold">Demo account</h1>
        <p className="mt-3 break-words text-moon-dim">
          Signed in with {session.contact}
        </p>
        {session.details && (
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-moon-dim">Full name</dt><dd>{session.details.fullName}</dd></div>
            <div><dt className="text-moon-dim">Date of birth</dt><dd><time dateTime={session.details.dateOfBirth}>{session.details.dateOfBirth.split("-").reverse().join("/")}</time></dd></div>
            {city && <div><dt className="text-moon-dim">Home city</dt><dd>{city.name}</dd></div>}
          </dl>
        )}
        <form action={signOutOfDemo} className="mt-6">
          <Button type="submit" variant="secondary">Sign out</Button>
        </form>
      </main>
    </>
  );
}

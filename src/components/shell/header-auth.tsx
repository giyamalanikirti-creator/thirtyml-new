import Link from "next/link";

import { getUserAndProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getMockUser } from "@/lib/mock-auth";
import { buttonVariants } from "@/components/ui/button";
import { UserMenu } from "./user-menu";

function signedOutLinks() {
  return (
    <div className="ml-1 flex items-center gap-1.5">
      <Link
        href="/login"
        className={
          buttonVariants({ variant: "ghost", size: "sm" }) +
          " hidden sm:inline-flex"
        }
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className={buttonVariants({ variant: "primary", size: "sm" })}
      >
        Sign up
      </Link>
    </div>
  );
}

/** Shows "Sign in / Sign up" when logged out, user initial + menu when in. */
export async function HeaderAuth() {
  // Mock mode: no Supabase keys → use the dummy session cookie.
  if (!isSupabaseConfigured()) {
    const mock = await getMockUser().catch(() => null);
    if (!mock) return signedOutLinks();
    const displayName =
      mock.fullName ?? mock.email ?? mock.phone ?? "You";
    const initial =
      mock.fullName?.[0]?.toUpperCase() ??
      mock.email?.[0]?.toUpperCase() ??
      mock.phone?.slice(-2) ??
      "U";
    return <UserMenu displayName={displayName} initial={initial} mock />;
  }

  // Real auth path.
  const session = await getUserAndProfile().catch(() => null);
  if (!session) return signedOutLinks();
  const initial =
    session.profile.full_name?.[0]?.toUpperCase() ??
    session.profile.email?.[0]?.toUpperCase() ??
    "U";
  return (
    <Link
      href="/account"
      aria-label="Account"
      className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-plum text-sm font-semibold text-moon hover:bg-plum-deep"
    >
      {initial}
    </Link>
  );
}

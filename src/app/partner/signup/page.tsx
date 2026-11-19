import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { DemoClubAccess } from "@/components/partner/demo-access";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default function PartnerSignupPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-aubergine/40 px-4 py-12">
      <Link href="/" className="mb-3 font-display text-2xl font-bold">Thirty<span className="text-plum-bright">ML</span></Link>
      <h1 className="mb-2 font-display text-2xl font-semibold">Create a club account</h1>
      <p className="mb-6 max-w-sm text-center text-sm text-moon-dim">
        {configured ? "Create your sign-in credentials, then apply to list your venue." : "Create credentials to try the club dashboard with sample bookings and earnings."}
      </p>
      {configured ? <Suspense><AuthForm mode="signup" partner credentialsOnly /></Suspense> : <DemoClubAccess mode="signup" />}
      <Link href="/partner/login" className="mt-5 text-sm text-plum-bright underline">Sign in to your club</Link>
    </main>
  );
}

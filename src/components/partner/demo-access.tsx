"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoClubAccess } from "@/app/partner/demo/actions";

export function DemoClubAccess({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const signup = mode === "signup";

  return (
    <form className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-night-raised p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        setError(null);
        startTransition(async () => {
          try {
            const result = await demoClubAccess(mode, values);
            if (result.error) setError(result.error);
            else {
              router.replace("/partner/demo/overview");
              router.refresh();
            }
          } catch {
            setError("Couldn’t open the demo club. Try again.");
          }
        });
      }}>
      <p className="text-sm text-moon-dim">Demo club accounts and changes are saved in this browser. Use sample contact details and a demo password.</p>
      {signup && (
        <>
          <label className="grid gap-1 text-sm">Club name<Input name="name" required minLength={2} maxLength={80} /></label>
          <label className="grid gap-1 text-sm">City<Input name="city" required minLength={2} maxLength={60} /></label>
        </>
      )}
      <label className="grid gap-1 text-sm">Club email<Input name="email" type="email" autoComplete="username" required /></label>
      <label className="grid gap-1 text-sm">Password<Input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={8} maxLength={72} /></label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" type="submit" disabled={busy}>{busy ? "Please wait…" : signup ? "Create demo club" : "Sign in as club"}</Button>
    </form>
  );
}

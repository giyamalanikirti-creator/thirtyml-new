"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { requestDemoCode, verifyDemoCode } from "@/app/demo-account/actions";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";
import {
  emailSchema,
  otpSchema,
  passwordSchema,
  phoneSchema,
  signupDetailsSchema,
} from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "login" | "signup";
type Method = "phone" | "email" | "magic";

export function AuthForm({
  mode,
  partner = false,
  cities = [],
  credentialsOnly = false,
}: {
  mode: Mode;
  partner?: boolean;
  cities?: { slug: string; name: string }[];
  credentialsOnly?: boolean;
}) {
  const collectDetails = mode === "signup" && !partner;
  const demo = !supabaseConfigured() && !partner;
  const router = useRouter();
  const params = useSearchParams();
  const requestedPath = params.get("next");
  const next = requestedPath?.startsWith("/") && !/^[/][\/\\]/.test(requestedPath)
    ? requestedPath
    : partner ? "/partner" : demo || mode === "login" ? "/clubs" : "/";

  const [method, setMethod] = React.useState<Method>(
    partner ? "email" : "phone"
  );
  const [details, setDetails] = React.useState({
    fullName: "",
    dateOfBirth: "",
    homeCity: "",
  });
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [otpSent, setOtpSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  if (!demo && !supabaseConfigured()) {
    return (
      <p className="rounded-md border border-line bg-night-raised p-4 text-sm text-moon-dim">
        Sign-in isn&apos;t configured in this environment yet (Supabase keys
        missing). Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable it.
      </p>
    );
  }

  const signup = collectDetails ? signupDetailsSchema.safeParse(details) : null;
  const profile = signup?.success ? signup.data : undefined;
  const metadata = profile && {
    full_name: profile.fullName,
    date_of_birth: profile.dateOfBirth,
    home_city: profile.homeCity,
  };
  const destination = profile && requestedPath !== next
    ? `/clubs?city=${encodeURIComponent(profile.homeCity)}`
    : next;
  const contact = { method, contact: method === "phone" ? phone : email };
  const usesCode = method === "phone" || demo;

  async function run(fn: () => Promise<string | null>) {
    if (signup && !signup.success) {
      setError(signup.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError(null);
    if (!demo || !otpSent) setNotice(null);
    try {
      const failure = await fn();
      if (failure) setError(failure);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp() {
    if (demo) {
      const result = await requestDemoCode(contact);
      if ("error" in result) return result.error ?? null;
      setOtpSent(true);
      setNotice(`Your demo code is ${result.code}.`);
      return null;
    }
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) return parsed.error.issues[0].message;
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      phone: parsed.data,
      options: { data: metadata },
    });
    if (error) return error.message;
    setOtpSent(true);
    setNotice("Code sent. It can take up to a minute to arrive.");
    return null;
  }

  async function verifyOtp() {
    if (demo) {
      const result = await verifyDemoCode(contact, otp, profile);
      if ("error" in result) return result.error ?? null;
      router.replace(destination);
      router.refresh();
      return null;
    }
    const parsedPhone = phoneSchema.safeParse(phone);
    const parsedOtp = otpSchema.safeParse(otp);
    if (!parsedPhone.success) return parsedPhone.error.issues[0].message;
    if (!parsedOtp.success) return parsedOtp.error.issues[0].message;
    const { error } = await supabaseBrowser().auth.verifyOtp({
      phone: parsedPhone.data,
      token: parsedOtp.data,
      type: "sms",
    });
    if (error) return error.message;
    router.push(destination);
    router.refresh();
    return null;
  }

  async function emailPassword() {
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) return parsedEmail.error.issues[0].message;
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) return parsedPassword.error.issues[0].message;

    const { data, error } =
      mode === "signup"
        ? await supabaseBrowser().auth.signUp({
            email: parsedEmail.data,
            password: parsedPassword.data,
            options: {
              data: metadata,
              emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
            },
          })
        : await supabaseBrowser().auth.signInWithPassword({
            email: parsedEmail.data,
            password: parsedPassword.data,
          });
    if (error) return error.message;
    if (mode === "signup" && !data.session) {
      setNotice("Check your inbox to confirm your email.");
      return null;
    }
    router.push(destination);
    router.refresh();
    return null;
  }

  async function magicLink() {
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) return parsedEmail.error.issues[0].message;
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: parsedEmail.data,
      options: {
        data: metadata,
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
      },
    });
    if (error) return error.message;
    setNotice("Magic link sent — check your inbox.");
    return null;
  }

  async function google() {
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) return error.message;
    return null;
  }

  return (
    <div className="w-full max-w-sm">
      {demo && (
        <p className="mb-4 rounded-md border border-line bg-night-raised p-3 text-sm text-moon-dim">
          Demo mode. Use a sample phone number or email address. The code appears here in the app.
        </p>
      )}
      {!credentialsOnly && (
        <div
          className={`mb-5 grid ${demo ? "grid-cols-2" : "grid-cols-3"} rounded-md border border-line p-1 text-sm`}
          role="tablist"
          aria-label="Sign-in method"
        >
          {(
            [
              ["phone", "Phone"],
              ["email", "Email"],
              ["magic", "Magic link"],
            ] as const
          ).filter(([value]) => !demo || value !== "magic").map(([value, label]) => (
            <button
              key={value}
              role="tab"
              disabled={busy}
              aria-selected={method === value}
              className={
                "rounded-sm py-1.5 " +
                (method === value
                  ? "bg-night-raised text-moon"
                  : "text-moon-dim hover:text-moon")
              }
              onClick={() => {
                setMethod(value);
                setOtpSent(false);
                setOtp("");
                setError(null);
                setNotice(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (usesCode) run(otpSent ? verifyOtp : sendOtp);
          else if (method === "email") run(emailPassword);
          else run(magicLink);
        }}
      >
        {collectDetails && (
          <fieldset className="space-y-3" disabled={busy || otpSent}>
            <legend className="mb-2 text-sm font-semibold">Your details</legend>
            <label className="block text-sm">
              <span className="mb-1 block text-moon-dim">Full name</span>
              <Input required autoComplete="name" maxLength={80} value={details.fullName}
                onChange={(e) => setDetails({ ...details, fullName: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-moon-dim">Date of birth</span>
              <Input required type="date" autoComplete="bday" value={details.dateOfBirth}
                onChange={(e) => setDetails({ ...details, dateOfBirth: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-moon-dim">Home city</span>
              <select required autoComplete="address-level2"
                className="h-10 w-full rounded-md border border-line bg-night-raised px-3 text-sm text-moon"
                value={details.homeCity}
                onChange={(e) => setDetails({ ...details, homeCity: e.target.value })}
              >
                <option value="">Select your city</option>
                {cities.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
              </select>
            </label>
          </fieldset>
        )}

        {method === "phone" && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block text-moon-dim">Mobile number</span>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={otpSent || busy}
              />
            </label>

          </>
        )}

        {(method === "email" || method === "magic") && (
          <label className="block text-sm">
            <span className="mb-1 block text-moon-dim">Email</span>
            <Input
              type="email"
              autoComplete="email"
              placeholder={demo ? "guest@example.com" : undefined}
              disabled={demo && (otpSent || busy)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}

        {method === "email" && !demo && (
          <label className="block text-sm">
            <span className="mb-1 block text-moon-dim">Password</span>
            <Input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}

        {usesCode && otpSent && (
          <label className="block text-sm">
            <span className="mb-1 block text-moon-dim">6-digit code</span>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {notice && <p className="text-sm text-drop">{notice}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy
            ? "Please wait…"
            : usesCode
              ? otpSent
                ? "Verify code"
                : "Send code"
              : method === "magic"
                ? "Send magic link"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
        </Button>
      </form>

      {demo && otpSent && (
        <button
          type="button"
          className="mt-3 text-sm text-plum-bright underline"
          disabled={busy}
          onClick={() => { setOtpSent(false); setOtp(""); setNotice(null); setError(null); }}
        >
          Change {method === "phone" ? "number" : "email"}
        </button>
      )}

      {!demo && !collectDetails && !credentialsOnly && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-moon-dim">
            <span className="h-px flex-1 bg-line" /> or{" "}
            <span className="h-px flex-1 bg-line" />
          </div>

          <Button
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={() => run(google)}
          >
            Continue with Google
          </Button>
        </>
      )}

      {partner && mode === "login" && method === "email" && (
        <Link className="mt-5 block text-center text-sm text-dusk hover:underline" href="/reset-password">Forgot password?</Link>
      )}
      {!credentialsOnly && !partner && (
        <p className="mt-5 text-center text-sm text-moon-dim">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link className="text-dusk hover:underline" href={partner ? "/partner/signup" : requestedPath === next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link className="text-dusk hover:underline" href={partner ? "/partner/login" : requestedPath === next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
                Sign in
              </Link>
            </>
          )}
          {!demo && method === "email" && mode === "login" && (
            <>
              {" · "}
              <Link className="text-dusk hover:underline" href="/reset-password">
                Forgot password?
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}

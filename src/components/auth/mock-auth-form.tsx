"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  emailSchema,
  otpSchema,
  phoneSchema,
  signupDetailsSchema,
} from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Dummy auth flow used when Supabase keys are absent.
 *
 * Login:  contact → OTP → done
 * Signup: contact → OTP → profile → age + ID upload → done
 *
 * Since there's no SMS/email channel the generated OTP is returned in the
 * response and shown on screen. The ID "scan" is a demo stub — it runs
 * basic sanity checks and labels itself as a demo on the result.
 */

type Mode = "login" | "signup";
type Method = "phone" | "email";
type Step = "contact" | "otp" | "profile" | "legal";

export function MockAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [method, setMethod] = React.useState<Method>("phone");
  const [value, setValue] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [devOtp, setDevOtp] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<Step>("contact");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Step 3 — profile
  const [fullName, setFullName] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [city, setCity] = React.useState("");

  // Step 4 — ID
  const [idChecks, setIdChecks] = React.useState<
    { name: string; passed: boolean; note?: string }[] | null
  >(null);
  const [idDisclaimer, setIdDisclaimer] = React.useState<string | null>(null);

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
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
    const parsed =
      method === "phone"
        ? phoneSchema.safeParse(value)
        : emailSchema.safeParse(value);
    if (!parsed.success) return parsed.error.issues[0].message;
    const res = await fetch("/api/mock-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "send",
        method,
        value: parsed.data,
        mode,
      }),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Could not send code";
    setDevOtp(typeof data.devOtp === "string" ? data.devOtp : null);
    setStep("otp");
    return null;
  }

  async function verifyOtp() {
    const parsedContact =
      method === "phone"
        ? phoneSchema.safeParse(value)
        : emailSchema.safeParse(value);
    const parsedOtp = otpSchema.safeParse(otp);
    if (!parsedContact.success) return parsedContact.error.issues[0].message;
    if (!parsedOtp.success) return parsedOtp.error.issues[0].message;
    const res = await fetch("/api/mock-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        method,
        value: parsedContact.data,
        otp: parsedOtp.data,
      }),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Could not verify code";
    if (mode === "signup") {
      setStep("profile");
    } else {
      router.push(next);
      router.refresh();
    }
    return null;
  }

  async function submitProfile() {
    const parsed = signupDetailsSchema.safeParse({
      fullName,
      dateOfBirth: dob,
      homeCity: city,
    });
    if (!parsed.success) return parsed.error.issues[0].message;
    const res = await fetch("/api/mock-auth/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Could not save profile";
    setStep("legal");
    return null;
  }

  async function uploadId(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/mock-auth/verify-id", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setIdChecks(data.checks ?? null);
    setIdDisclaimer(data.disclaimer ?? null);
    if (!res.ok) return data.error ?? data.reason ?? "ID check failed";
    router.push(next);
    router.refresh();
    return null;
  }

  return (
    <div className="w-full max-w-sm">
      <p className="mb-4 rounded-md border border-line bg-night-raised p-3 text-xs text-moon-dim">
        Demo mode — Supabase isn&apos;t configured, so this is a dummy flow.
        Codes are shown on screen, ID scanning is a stub.
      </p>

      {step === "contact" && (
        <ContactStep
          method={method}
          value={value}
          onMethod={(m) => {
            setMethod(m);
            setValue("");
            setError(null);
          }}
          onValue={setValue}
          onSubmit={() => run(sendOtp)}
          busy={busy}
          error={error}
        />
      )}

      {step === "otp" && (
        <OtpStep
          method={method}
          value={value}
          otp={otp}
          onOtp={setOtp}
          devOtp={devOtp}
          onSubmit={() => run(verifyOtp)}
          onBack={() => {
            setStep("contact");
            setOtp("");
            setDevOtp(null);
            setError(null);
          }}
          busy={busy}
          error={error}
          mode={mode}
        />
      )}

      {step === "profile" && (
        <ProfileStep
          fullName={fullName}
          onFullName={setFullName}
          dob={dob}
          onDob={setDob}
          city={city}
          onCity={setCity}
          onSubmit={() => run(submitProfile)}
          busy={busy}
          error={error}
        />
      )}

      {step === "legal" && (
        <LegalStep
          onUpload={(file) => run(() => uploadId(file))}
          checks={idChecks}
          disclaimer={idDisclaimer}
          busy={busy}
          error={error}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- steps

function ContactStep(props: {
  method: Method;
  value: string;
  onMethod: (m: Method) => void;
  onValue: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <div
        className="grid grid-cols-2 rounded-md border border-line p-1 text-sm"
        role="tablist"
        aria-label="Sign-in method"
      >
        {(["phone", "email"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={props.method === m}
            className={
              "rounded-sm py-1.5 " +
              (props.method === m
                ? "bg-night-raised text-moon"
                : "text-moon-dim hover:text-moon")
            }
            onClick={() => props.onMethod(m)}
          >
            {m === "phone" ? "Phone" : "Email"}
          </button>
        ))}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-moon-dim">
          {props.method === "phone" ? "Mobile number" : "Email address"}
        </span>
        <Input
          type={props.method === "phone" ? "tel" : "email"}
          inputMode={props.method === "phone" ? "tel" : "email"}
          autoComplete={props.method === "phone" ? "tel" : "email"}
          placeholder={
            props.method === "phone" ? "98765 43210" : "you@example.com"
          }
          value={props.value}
          onChange={(e) => props.onValue(e.target.value)}
          required
        />
      </label>

      {props.error && (
        <p role="alert" className="text-sm text-red-400">
          {props.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={props.busy}>
        {props.busy ? "Sending…" : "Send code"}
      </Button>
    </form>
  );
}

function OtpStep(props: {
  method: Method;
  value: string;
  otp: string;
  onOtp: (v: string) => void;
  devOtp: string | null;
  onSubmit: () => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
  mode: Mode;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <p className="text-sm text-moon-dim">
        Code sent to <span className="text-moon">{props.value}</span>.
      </p>

      <label className="block text-sm">
        <span className="mb-1 block text-moon-dim">6-digit code</span>
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          value={props.otp}
          onChange={(e) =>
            props.onOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          required
        />
      </label>

      {props.devOtp && (
        <p className="rounded-md border border-dashed border-line bg-night-raised px-3 py-2 text-xs text-moon-dim">
          Your code (demo):{" "}
          <span className="font-mono text-moon">{props.devOtp}</span>
        </p>
      )}

      {props.error && (
        <p role="alert" className="text-sm text-red-400">
          {props.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={props.busy}>
        {props.busy
          ? "Verifying…"
          : props.mode === "signup"
            ? "Continue"
            : "Sign in"}
      </Button>

      <button
        type="button"
        className="w-full text-xs text-moon-dim hover:text-moon"
        onClick={props.onBack}
      >
        Use a different {props.method === "phone" ? "number" : "email"}
      </button>
    </form>
  );
}

function ProfileStep(props: {
  fullName: string;
  onFullName: (v: string) => void;
  dob: string;
  onDob: (v: string) => void;
  city: string;
  onCity: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <h2 className="font-display text-base font-semibold">About you</h2>

      <label className="block text-sm">
        <span className="mb-1 block text-moon-dim">Full name</span>
        <Input
          type="text"
          autoComplete="name"
          value={props.fullName}
          onChange={(e) => props.onFullName(e.target.value)}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-moon-dim">Date of birth</span>
        <Input
          type="date"
          autoComplete="bday"
          value={props.dob}
          onChange={(e) => props.onDob(e.target.value)}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-moon-dim">Home city</span>
        <Input
          type="text"
          placeholder="Bengaluru"
          value={props.city}
          onChange={(e) => props.onCity(e.target.value)}
          required
        />
      </label>

      {props.error && (
        <p role="alert" className="text-sm text-red-400">
          {props.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={props.busy}>
        {props.busy ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

function LegalStep(props: {
  onUpload: (file: File) => void;
  checks: { name: string; passed: boolean; note?: string }[] | null;
  disclaimer: string | null;
  busy: boolean;
  error: string | null;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-line bg-night-raised p-4">
        <h2 className="font-display text-base font-semibold">
          Are you of legal age?
        </h2>
        <p className="mt-1 text-sm text-moon-dim">
          Entry to ThirtyML clubs and events is restricted to guests who are 18
          or older (21+ at venues where state rules require it). Upload a
          government-issued photo ID so we can confirm your age.
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const file = fileRef.current?.files?.[0];
          if (!file) return;
          props.onUpload(file);
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-moon-dim">
            Photo of your ID (Aadhaar, DL, passport)
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="block w-full text-sm text-moon file:mr-3 file:rounded-md file:border file:border-line file:bg-night-raised file:px-3 file:py-1.5 file:text-moon-dim hover:file:text-moon"
          />
        </label>

        {props.checks && (
          <ul className="space-y-1 rounded-md border border-line bg-night-raised p-3 text-xs">
            {props.checks.map((c) => (
              <li key={c.name} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={
                    c.passed ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {c.passed ? "✓" : "✗"}
                </span>
                <span className="text-moon-dim">{c.name}</span>
                {c.note && (
                  <span className="text-moon-faint">· {c.note}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {props.error && (
          <p role="alert" className="text-sm text-red-400">
            {props.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={props.busy}>
          {props.busy ? "Checking…" : "Upload & verify"}
        </Button>

        {props.disclaimer && (
          <p className="text-[11px] text-moon-faint">{props.disclaimer}</p>
        )}
      </form>
    </div>
  );
}

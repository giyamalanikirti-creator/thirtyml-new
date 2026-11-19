"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { otpSchema, phoneSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Dummy OTP flow used when Supabase keys are absent. The server returns the
 * generated code in the response so the UI can display it — there is no SMS
 * channel. Signup and login use the same flow; signup just labels the CTA.
 */

type Mode = "login" | "signup";

export function MockAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [devOtp, setDevOtp] = React.useState<string | null>(null);
  const [otpSent, setOtpSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function sendOtp() {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) return parsed.error.issues[0].message;
    const res = await fetch("/api/mock-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", phone: parsed.data, mode }),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Could not send code";
    setOtpSent(true);
    setDevOtp(typeof data.devOtp === "string" ? data.devOtp : null);
    return null;
  }

  async function verifyOtp() {
    const parsedPhone = phoneSchema.safeParse(phone);
    const parsedOtp = otpSchema.safeParse(otp);
    if (!parsedPhone.success) return parsedPhone.error.issues[0].message;
    if (!parsedOtp.success) return parsedOtp.error.issues[0].message;
    const res = await fetch("/api/mock-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        phone: parsedPhone.data,
        otp: parsedOtp.data,
      }),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Could not verify code";
    router.push(next);
    router.refresh();
    return null;
  }

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

  return (
    <div className="w-full max-w-sm">
      <p className="mb-4 rounded-md border border-line bg-night-raised p-3 text-xs text-moon-dim">
        Demo mode — Supabase isn&apos;t configured, so this is a dummy OTP
        flow. The code is shown on screen instead of being sent by SMS.
      </p>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(otpSent ? verifyOtp : sendOtp);
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-moon-dim">Mobile number</span>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={otpSent}
            required
          />
        </label>

        {otpSent && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block text-moon-dim">6-digit code</span>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
              />
            </label>
            {devOtp && (
              <p className="rounded-md border border-dashed border-line bg-night-raised px-3 py-2 text-xs text-moon-dim">
                Your code (demo):{" "}
                <span className="font-mono text-moon">{devOtp}</span>
              </p>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy
            ? "Working…"
            : otpSent
              ? mode === "signup"
                ? "Create account"
                : "Sign in"
              : "Send code"}
        </Button>

        {otpSent && (
          <button
            type="button"
            className="w-full text-xs text-moon-dim hover:text-moon"
            onClick={() => {
              setOtp("");
              setOtpSent(false);
              setDevOtp(null);
              setError(null);
            }}
          >
            Use a different number
          </button>
        )}
      </form>
    </div>
  );
}

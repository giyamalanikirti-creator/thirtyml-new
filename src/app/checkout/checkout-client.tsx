"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { CartView } from "@/lib/cart";
import type { Totals } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPaise } from "@/lib/utils";
import { checkCoupon, submitCheckout } from "./actions";

const nightFmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

export function CheckoutClient({
  view,
  initialTotals,
  walletBalance,
  profile,
}: {
  view: CartView;
  initialTotals: Totals;
  walletBalance: number;
  profile: { name: string; phone: string; email: string };
}) {
  const router = useRouter();
  const [name, setName] = React.useState(profile.name);
  const [phone, setPhone] = React.useState(profile.phone);
  const [email, setEmail] = React.useState(profile.email);
  const [couponInput, setCouponInput] = React.useState("");
  const [appliedCoupon, setAppliedCoupon] = React.useState<string | null>(null);
  const [useWallet, setUseWallet] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);
  const [totals, setTotals] = React.useState(initialTotals);
  const [couponMessage, setCouponMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [choosePayment, setChoosePayment] = React.useState(false);
  const [busy, setBusy] = React.useState<"coupon" | "pay" | null>(null);

  async function refreshTotals(code: string | null, wallet: boolean) {
    const result = await checkCoupon(code ?? "", wallet);
    setTotals(result.totals);
    return result;
  }

  async function applyCoupon() {
    setBusy("coupon");
    setCouponMessage(null);
    try {
      const result = await refreshTotals(couponInput, useWallet);
      if (result.couponError) {
        setAppliedCoupon(null);
        setCouponMessage(result.couponError);
      } else if (couponInput) {
        setAppliedCoupon(couponInput);
        setCouponMessage(`Applied — you save ${formatPaise(result.totals.discount)}`);
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggleWallet(next: boolean) {
    setBusy("coupon");
    setError(null);
    try {
      await refreshTotals(appliedCoupon, next);
      setUseWallet(next);
    } catch {
      setError("Couldn't update the totals. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function pay(paymentMethod: "online" | "venue") {
    setBusy("pay");
    setError(null);
    try {
      const result = await submitCheckout({
        name,
        phone,
        email,
        couponCode: appliedCoupon ?? undefined,
        useWallet,
        agreed,
        paymentMethod,
      });
      if (!result.ok) {
        setError(result.error);
        setBusy(null);
        return;
      }
      router.replace(`/orders/${result.orderId}${paymentMethod === "online" ? "/pay" : ""}`);
    } catch {
      setError("Couldn't complete checkout. Please try again.");
      setBusy(null);
    }
  }

  const active = view.lines.filter((l) => !l.savedForLater);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <fieldset disabled={busy === "pay" || choosePayment} className="min-w-0 space-y-8">
          <legend className="sr-only">Order details</legend>
          <section>
            <h2 className="font-display text-lg font-semibold">1 · Review</h2>
            <ul className="mt-3 divide-y divide-line rounded-md border border-line">
              {active.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span>
                    {line.productName} ×{line.quantity}
                    <span className="ml-2 text-moon-dim">
                      {line.clubName} ·{" "}
                      {nightFmt.format(new Date(`${line.nightDate}T12:00:00`))}
                    </span>
                  </span>
                  <span className="tnum font-medium">
                    {formatPaise(line.currentPrice * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">
              2 · Lead guest
            </h2>
            <p className="mt-1 text-xs text-moon-dim">
              The QR ticket and receipts go to these details. ID is checked at
              the door.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block text-moon-dim">Full name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-moon-dim">Phone</span>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-moon-dim">Email</span>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
              </label>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">3 · Offers</h2>
            <div className="mt-3 flex max-w-sm gap-2">
              <Input
                placeholder="Coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                aria-label="Coupon code"
              />
              <Button
                variant="secondary"
                disabled={busy !== null || !couponInput}
                onClick={applyCoupon}
              >
                {busy === "coupon" ? "Checking…" : "Apply"}
              </Button>
            </div>
            {couponMessage && (
              <p
                className={
                  "mt-2 text-sm " +
                  (totals.discount > 0 ? "text-drop" : "text-danger")
                }
              >
                {couponMessage}
              </p>
            )}
            {walletBalance > 0 && (
              <label className="mt-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useWallet}
                  disabled={busy !== null}
                  onChange={(e) => toggleWallet(e.target.checked)}
                />
                Use wallet credit ({formatPaise(walletBalance)} available)
              </label>
            )}
          </section>
        </fieldset>
      </div>

      <aside>
        <div className="sticky top-20 rounded-md border border-line bg-moon p-5 text-night">
          <h2 className="font-display font-semibold">Price breakdown</h2>
          <dl className="tnum mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatPaise(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Discount</dt>
                <dd>−{formatPaise(totals.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Convenience fee</dt>
              <dd>{formatPaise(totals.convenienceFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>GST on fee</dt>
              <dd>{formatPaise(totals.tax)}</dd>
            </div>
            {totals.walletUsed > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Wallet credit</dt>
                <dd>−{formatPaise(totals.walletUsed)}</dd>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-night/20 pt-2 font-display text-base font-bold">
              <dt>Total</dt>
              <dd>{formatPaise(totals.total)}</dd>
            </div>
          </dl>

          <label className="mt-4 flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={agreed}
              disabled={busy === "pay" || choosePayment}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the{" "}
              <a href="/legal/terms" target="_blank" className="underline">
                terms
              </a>{" "}
              and{" "}
              <a href="/legal/refunds" target="_blank" className="underline">
                refund policy
              </a>
              .
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          {choosePayment ? (
            <fieldset disabled={busy !== null} className="mt-4 space-y-2 border-t border-night/20 pt-4">
              <legend className="sr-only">Payment method</legend>
              <h3 className="font-display font-semibold">Choose how to pay</h3>
              <Button className="w-full" disabled={useWallet} onClick={() => pay("venue")}>
                Pay at the venue
              </Button>
              <p className="text-xs text-night/70">
                {useWallet
                  ? "Edit your details to turn off wallet credit for venue payment."
                  : "Reserve now, get your QR ticket and pay when you arrive."}
              </p>
              <Button className="w-full" variant="secondary" onClick={() => pay("online")}>
                Pay online · {formatPaise(totals.total)}
              </Button>
              <button
                type="button"
                className="text-sm underline underline-offset-4"
                onClick={() => { setChoosePayment(false); setError(null); }}
              >
                Edit checkout details
              </button>
              {busy === "pay" && <p role="status" className="text-sm">Confirming your checkout…</p>}
            </fieldset>
          ) : (
            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={busy !== null || !agreed}
              onClick={() => {
                setError(null);
                if (!name.trim() || !phone.trim() || !email.trim()) {
                  setError("Enter the lead guest's name, phone and email.");
                  return;
                }
                setChoosePayment(true);
              }}
            >
              Proceed to checkout
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

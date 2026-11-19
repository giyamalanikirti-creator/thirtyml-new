"use client";

import * as React from "react";
import Link from "next/link";
import {
  cartSubtotalPaise,
  clearCart,
  readCart,
  type DemoCartItem,
} from "@/lib/demo-cart";
import { formatPaise } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PayChoice = "pay_now" | "pay_at_venue";
type Stage = "choose" | "paying" | "done";

const EMPTY: DemoCartItem[] = [];

function subscribeToCart(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener("thirtyml:cart", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("thirtyml:cart", cb);
  };
}

export function CheckoutClient() {
  const cart = React.useSyncExternalStore<DemoCartItem[] | null>(
    subscribeToCart,
    () => readCart(),
    () => null
  );
  const [choice, setChoice] = React.useState<PayChoice>("pay_now");
  const [stage, setStage] = React.useState<Stage>("choose");
  const [ticketId, setTicketId] = React.useState<string>("");

  if (cart === null) {
    return <p className="text-sm text-moon-dim">Loading your cart…</p>;
  }

  if (cart.length === 0 && stage !== "done") {
    return (
      <div className="rounded-md border border-line bg-night-raised p-6 text-center">
        <p className="text-sm text-moon-dim">Your cart is empty.</p>
        <Link
          href="/demo"
          className="mt-3 inline-block text-sm text-dusk hover:underline"
        >
          Browse the demo event →
        </Link>
      </div>
    );
  }

  if (stage === "done") {
    const paidLabel =
      choice === "pay_now" ? "Payment received" : "Pay at the door";
    return (
      <div className="rounded-md border border-line bg-night-raised p-6 text-center">
        <p className="font-display text-xl font-semibold text-emerald-300">
          Ticket in your inbox 🎟️
        </p>
        <p className="mt-2 text-sm text-moon-dim">
          {paidLabel} · Booking ref{" "}
          <span className="font-mono text-moon">{ticketId}</span>
        </p>
        <p className="mt-4 text-sm text-moon-dim">
          We&apos;ve sent the ticket to the contact on your account. Show the
          QR at the door.
        </p>
        <Link
          href="/demo"
          className="mt-6 inline-block text-sm text-dusk hover:underline"
        >
          Back to demo
        </Link>
      </div>
    );
  }

  function pay() {
    setStage("paying");
    // Fake network round-trip so the UI feels real.
    setTimeout(() => {
      clearCart();
      window.dispatchEvent(new Event("thirtyml:cart"));
      setTicketId(makeTicketId());
      setStage("done");
    }, 600);
  }

  const subtotal = cartSubtotalPaise(cart ?? EMPTY);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-semibold">Checkout</h1>
        <p className="mt-1 text-sm text-moon-dim">
          Choose how you want to pay. Both options reserve your spot and send
          the ticket to your inbox.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-moon-dim">
          Your cart
        </h2>
        <ul className="divide-y divide-line rounded-md border border-line bg-night-raised">
          {cart.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="font-display text-sm font-semibold">
                  {i.title}
                </p>
                <p className="text-xs text-moon-dim">{i.subtitle}</p>
              </div>
              <p className="text-sm text-moon">
                {i.qty} × {formatPaise(i.pricePaise)}
              </p>
            </li>
          ))}
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-moon-dim">Total</span>
            <span className="font-display text-base font-semibold">
              {formatPaise(subtotal)}
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-moon-dim">
          Payment
        </h2>
        <div className="space-y-2">
          <PayOption
            id="pay_now"
            label="Pay right now"
            hint="Card / UPI · ticket emailed instantly"
            checked={choice === "pay_now"}
            onChange={setChoice}
          />
          <PayOption
            id="pay_at_venue"
            label="Pay at the venue"
            hint="Spot held for 90 minutes past door-open · pay cash or card at entry"
            checked={choice === "pay_at_venue"}
            onChange={setChoice}
          />
        </div>
      </section>

      <Button onClick={pay} disabled={stage === "paying"} className="w-full">
        {stage === "paying"
          ? "Working…"
          : choice === "pay_now"
            ? `Pay ${formatPaise(subtotal)}`
            : "Reserve — pay at venue"}
      </Button>
    </div>
  );
}

function PayOption({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: PayChoice;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: PayChoice) => void;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-md border p-3 " +
        (checked
          ? "border-plum bg-night-raised"
          : "border-line bg-night-raised hover:border-plum/60")
      }
    >
      <input
        type="radio"
        name="payment"
        value={id}
        checked={checked}
        onChange={() => onChange(id)}
        className="mt-1 accent-plum-bright"
      />
      <div>
        <p className="text-sm font-semibold text-moon">{label}</p>
        <p className="text-xs text-moon-dim">{hint}</p>
      </div>
    </label>
  );
}

function makeTicketId() {
  // TML-<4 digits>-<4 letters>, non-cryptographic — just a readable demo id.
  const digits = Math.floor(1000 + Math.random() * 9000);
  const letters = Array.from(
    { length: 4 },
    () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]
  ).join("");
  return `TML-${digits}-${letters}`;
}

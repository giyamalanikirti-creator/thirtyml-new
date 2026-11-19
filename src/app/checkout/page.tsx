import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Header } from "@/components/shell/header";
import { getDemoSession } from "@/lib/demo-session";
import { getUserAndProfile } from "@/lib/auth";
import { getCartView } from "@/lib/cart";
import { getWalletBalance, previewTotals } from "@/lib/orders";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const demo = await getDemoSession();
  const session = demo ? null : await getUserAndProfile();
  if (!demo && !session) redirect("/login?next=/checkout");
  const profile = session?.profile;
  const view = await getCartView();
  const active = view.lines.filter((l) => !l.savedForLater);
  if (active.length === 0) redirect("/cart");
  if (view.needsAcknowledgement) redirect("/cart");

  const [{ totals }, walletBalance] = await Promise.all([
    previewTotals(view, null, false, session?.userId ?? null),
    getWalletBalance(),
  ]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="font-display text-2xl font-semibold">Checkout</h1>
        <p className="mt-1 text-sm text-moon-dim">
          Review your tickets and guest details before choosing how to pay.
        </p>
        {demo && (
          <p className="mt-2 text-sm text-moon-dim">Demo checkout lets you review your cart and payment options. Live booking requires a configured store.</p>
        )}
        <Link href="/cart" className="mt-2 inline-block text-sm text-plum-bright underline underline-offset-4">
          Edit cart
        </Link>
        <div className="mt-6">
          <CheckoutClient
            view={view}
            initialTotals={totals}
            walletBalance={walletBalance}
            profile={{
              name: profile?.full_name ?? demo?.details?.fullName ?? "",
              phone: profile?.phone ?? (demo?.method === "phone" ? demo.contact : ""),
              email: profile?.email ?? (demo?.method === "email" ? demo.contact : ""),
            }}
          />
        </div>
      </main>
    </>
  );
}

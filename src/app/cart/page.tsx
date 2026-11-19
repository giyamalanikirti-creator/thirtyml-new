import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Header } from "@/components/shell/header";
import { Footer } from "@/components/shell/footer";
import { getCartView } from "@/lib/cart";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { CartViewClient } from "./cart-view";

export const metadata: Metadata = { title: "Cart" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  // Demo mode uses the client-side demo cart on /demo/checkout — hop there
  // instead of redirecting to login for a DB cart that doesn't exist.
  if (!isSupabaseConfigured()) redirect("/demo/checkout");
  const view = await getCartView();
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="font-display text-2xl font-semibold">Your cart</h1>
        <CartViewClient view={view} />
      </main>
      <Footer />
    </>
  );
}

import type { ReactNode } from "react";
import { Header } from "@/components/shell/header";
import { Footer } from "@/components/shell/footer";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <p className="mb-6 rounded-md border border-line bg-night-raised p-3 text-xs text-moon-dim">
          Demo flow — a lightweight add-to-cart → pay → confirmation path that
          runs without a database. Prices and ticket IDs are faked for the
          demo.
        </p>
        {children}
      </main>
      <Footer />
    </>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-6xl flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-sm text-sm text-moon-dim">
        That wasn&apos;t supposed to happen. Your cart and bookings are safe —
        try again, or head back home.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/demo/checkout"
          className={buttonVariants({ variant: "ghost" })}
        >
          Go to checkout
        </Link>
        <Link href="/" className={buttonVariants({ variant: "ghost" })}>
          Home
        </Link>
      </div>
      {error?.digest && (
        <p className="mt-6 text-[11px] text-moon-faint">ref {error.digest}</p>
      )}
    </main>
  );
}

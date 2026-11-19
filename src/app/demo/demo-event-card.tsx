"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatPaise } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { addItem } from "@/lib/demo-cart";

export function DemoEventCard({
  id,
  title,
  subtitle,
  pricePaise,
}: {
  id: string;
  title: string;
  subtitle: string;
  pricePaise: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  function onAdd() {
    setBusy(true);
    addItem({ id, title, subtitle, pricePaise });
    router.push("/demo/checkout");
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-4 rounded-md border border-line bg-night-raised p-4">
      <div>
        <p className="font-display text-base font-semibold">General entry</p>
        <p className="text-sm text-moon-dim">
          One ticket · {formatPaise(pricePaise)}
        </p>
      </div>
      <Button onClick={onAdd} disabled={busy}>
        {busy ? "Adding…" : "Add to cart"}
      </Button>
    </div>
  );
}

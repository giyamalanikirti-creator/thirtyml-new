"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  displayName: string;
  initial: string;
  /** If true, the logout button calls /api/mock-auth {action:"logout"}. */
  mock?: boolean;
};

/**
 * Header avatar + dropdown. Shows the user's initial, opens a small menu
 * with "Edit profile" and "Logout" on click, closes on outside-click or
 * Escape.
 */
export function UserMenu({ displayName, initial, mock }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      if (mock) {
        await fetch("/api/mock-auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        });
      } else {
        // Supabase path handled elsewhere; this component is mock-only for
        // now, so fall through to a refresh.
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 min-w-9 items-center gap-2 rounded-full bg-plum pl-1 pr-3 text-sm font-semibold text-moon hover:bg-plum-deep"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-night-raised text-moon">
          {initial}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">
          {displayName}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border border-line bg-night-raised py-1 shadow-xl"
        >
          <Link
            role="menuitem"
            href="/account"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-moon hover:bg-night"
          >
            Edit profile
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={logout}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-sm text-moon hover:bg-night disabled:opacity-60"
          >
            {busy ? "Signing out…" : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}

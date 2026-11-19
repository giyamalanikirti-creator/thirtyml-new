/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";

/**
 * Cover artwork for a club or event. Renders through a plain <img> so it can
 * fall back to the deterministic /api/club-cover/<slug> SVG if the real
 * photo ever fails (Unsplash 404, upstream outage, blocked network).
 * Keeping this one component as the single cover renderer means every
 * surface — card, hero, event — degrades the same way.
 */
export function ClubCover({
  slug,
  name,
  imageUrl,
  priority = false,
  className,
}: {
  slug: string;
  name: string;
  imageUrl: string | null | undefined;
  priority?: boolean;
  /** Extra classes added to the <img>. Default fills the parent as cover. */
  className?: string;
}) {
  const fallback = coverUrl(slug, name);
  const initial =
    imageUrl && imageUrl.length > 0 ? imageUrl : fallback;
  const [src, setSrc] = React.useState(initial);
  const [seenInitial, setSeenInitial] = React.useState(initial);

  // If the parent swaps `imageUrl` (route change, parent re-render), re-seed
  // without an effect — the React-recommended pattern for state that
  // depends on props.
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setSrc(initial);
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
      className={
        className ??
        "absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      }
    />
  );
}

/** URL for the generated SVG cover — stable per slug. */
export function coverUrl(slug: string, name?: string): string {
  const base = `/api/club-cover/${encodeURIComponent(slug)}`;
  return name ? `${base}?name=${encodeURIComponent(name)}` : base;
}

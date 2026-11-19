/* eslint-disable @next/next/no-img-element */
import Image from "next/image";

/**
 * Cover artwork for a club. When imageUrl is a real photo, renders through
 * next/image. When it's one of our generated SVGs (or missing), falls
 * through to a plain <img> so we don't need dangerouslyAllowSVG and don't
 * pay the optimiser overhead on tiny deterministic art.
 */
export function ClubCover({
  slug,
  name,
  imageUrl,
  priority = false,
  sizes,
}: {
  slug: string;
  name: string;
  imageUrl: string | null | undefined;
  priority?: boolean;
  sizes?: string;
}) {
  const src = imageUrl || coverUrl(slug, name);
  const isGenerated = src.startsWith("/api/club-cover/");

  if (isGenerated) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        loading={priority ? "eager" : "lazy"}
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      fill
      priority={priority}
      sizes={sizes}
      className="object-cover"
    />
  );
}

/** URL for the generated cover — stable per slug. */
export function coverUrl(slug: string, name?: string): string {
  const base = `/api/club-cover/${encodeURIComponent(slug)}`;
  return name ? `${base}?name=${encodeURIComponent(name)}` : base;
}

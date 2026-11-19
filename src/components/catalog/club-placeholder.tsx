import { clubGradient } from "./club-card";

/**
 * Standing-in artwork for clubs with no photo yet. The dotted grain + a
 * stamped monogram and name make the absence look like a deliberate card
 * instead of a broken image.
 */
export function ClubPlaceholder({
  name,
  slug,
  size = "card",
  className,
}: {
  name: string;
  slug: string;
  /** "card" for grid tiles, "hero" for the club detail page. */
  size?: "card" | "hero";
  className?: string;
}) {
  const initial =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "·";

  return (
    <div
      aria-hidden
      className={"absolute inset-0 " + (className ?? "")}
      style={{ background: clubGradient(slug) }}
    >
      {/* Soft dotted grain — scales naturally in CSS, no external asset. */}
      <div
        className="absolute inset-0 opacity-25 mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: size === "hero" ? "14px 14px" : "10px 10px",
        }}
      />

      {/* Diagonal highlight sweep. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.25) 100%)",
        }}
      />

      {/* Centred monogram + name. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-moon">
        <span
          className={
            "font-display font-bold tracking-tight opacity-90 " +
            (size === "hero" ? "text-6xl sm:text-7xl" : "text-4xl")
          }
        >
          {initial}
        </span>
        <span
          className={
            "mt-1 px-3 text-center font-display tracking-wide opacity-80 " +
            (size === "hero"
              ? "text-sm uppercase sm:text-base"
              : "text-[11px] uppercase")
          }
        >
          {name}
        </span>
      </div>
    </div>
  );
}

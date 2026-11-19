import { NextResponse } from "next/server";

/**
 * Deterministic SVG cover for a club, keyed by slug. Lives behind this
 * route so every club has artwork without needing a real photo pipeline or
 * an external image key. The output is a self-contained SVG — safe to drop
 * into an <img src>. 1200×900 so it works for both the card (4:3) and the
 * detail-page hero.
 */

export const runtime = "nodejs";
// Immutable per slug — cache it hard.
const CACHE = "public, max-age=31536000, immutable";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length];
}

type Palette = { c1: string; c2: string; accent: string };

// Night-club adjacent palettes — plum / cobalt / rose / teal / amber-noir.
const PALETTES: readonly Palette[] = [
  { c1: "#2b1247", c2: "#8b2a7a", accent: "#f7a521" },
  { c1: "#0b1b3a", c2: "#1f5ec4", accent: "#ff7ad9" },
  { c1: "#241236", c2: "#b23a7a", accent: "#ffd166" },
  { c1: "#0d2a2e", c2: "#1aa37a", accent: "#f6c667" },
  { c1: "#2a0d1a", c2: "#c4344b", accent: "#ffc5cd" },
  { c1: "#1a1030", c2: "#6b3bd1", accent: "#8df0ff" },
];

type Motif = "rings" | "sparks" | "stripes" | "grid";
const MOTIFS: readonly Motif[] = ["rings", "sparks", "stripes", "grid"];

function monogram(name: string) {
  const parts = name
    .replace(/[^A-Za-z0-9 &']/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "·";
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<"
      ? "&lt;"
      : c === ">"
        ? "&gt;"
        : c === "&"
          ? "&amp;"
          : c === '"'
            ? "&quot;"
            : "&apos;"
  );
}

function render(slug: string, name: string): string {
  const seed = hash(slug);
  const { c1, c2, accent } = pick(PALETTES, seed);
  const motif = pick(MOTIFS, seed >> 3);
  const angle = 15 + ((seed >> 7) % 40); // 15–54 deg
  const initials = monogram(name);
  const cleanName = escapeXml(name.toUpperCase());

  let motifSvg = "";
  if (motif === "rings") {
    motifSvg = `
      <g stroke="${accent}" stroke-width="2" fill="none" opacity="0.35">
        <circle cx="980" cy="210" r="180" />
        <circle cx="980" cy="210" r="120" />
        <circle cx="980" cy="210" r="60" />
      </g>`;
  } else if (motif === "sparks") {
    const sparks: string[] = [];
    const rng = mulberry32(seed);
    for (let i = 0; i < 18; i++) {
      const x = 80 + rng() * 1040;
      const y = 80 + rng() * 740;
      const r = 1.4 + rng() * 2.6;
      const op = (0.25 + rng() * 0.45).toFixed(2);
      sparks.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(
          2
        )}" fill="${accent}" opacity="${op}" />`
      );
    }
    motifSvg = `<g>${sparks.join("")}</g>`;
  } else if (motif === "stripes") {
    motifSvg = `
      <g opacity="0.22">
        <rect x="-200" y="620" width="2000" height="40" fill="${accent}" transform="rotate(-${angle} 600 450)" />
        <rect x="-200" y="700" width="2000" height="14" fill="${accent}" transform="rotate(-${angle} 600 450)" />
        <rect x="-200" y="760" width="2000" height="6"  fill="${accent}" transform="rotate(-${angle} 600 450)" />
      </g>`;
  } else {
    motifSvg = `
      <defs>
        <pattern id="grid-${seed}" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="${accent}" stroke-width="0.6" opacity="0.35"/>
        </pattern>
      </defs>
      <rect x="0" y="0" width="1200" height="900" fill="url(#grid-${seed})" opacity="0.4" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${cleanName}">
  <defs>
    <linearGradient id="g-${seed}" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="v-${seed}" cx="0.5" cy="0.6" r="0.85">
      <stop offset="0.5" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#g-${seed})"/>
  ${motifSvg}
  <rect width="1200" height="900" fill="url(#v-${seed})"/>
  <g font-family="'Bricolage Grotesque', 'Inter', system-ui, sans-serif" fill="#F5F0FF">
    <text x="90" y="430" font-size="220" font-weight="800" letter-spacing="-6" opacity="0.92">${escapeXml(
      initials
    )}</text>
    <text x="96" y="500" font-size="44" font-weight="600" letter-spacing="8" opacity="0.85">${cleanName}</text>
    <rect x="96" y="540" width="80" height="4" fill="${accent}" opacity="0.95"/>
  </g>
</svg>`;
}

// Tiny PRNG so spark layouts are deterministic per slug.
function mulberry32(a: number) {
  let t = a >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? titleise(slug);
  const svg = render(slug, name);
  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": CACHE,
    },
  });
}

function titleise(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

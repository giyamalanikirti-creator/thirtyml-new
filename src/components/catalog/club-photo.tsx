"use client";

import { useState } from "react";
import Image from "next/image";

const nightlifePhotos = [
  "/clubs/dance-floor.jpg",
  "/clubs/dj-night.jpg",
  "/clubs/live-night.jpg",
];

export function ClubPhoto({
  src,
  slug,
  sizes,
  className,
  priority,
}: {
  src?: string | null;
  slug: string;
  sizes: string;
  className: string;
  priority?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const photoIndex = [...slug].reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 0);
  const fallback = nightlifePhotos[photoIndex % nightlifePhotos.length];
  const source = src && src !== failedSource ? src : fallback;

  return (
    <Image
      src={source}
      alt=""
      fill
      priority={priority}
      sizes={sizes}
      className={className}
      onError={source === fallback ? undefined : () => setFailedSource(source)}
    />
  );
}

"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { formatPaise } from "@/lib/utils";
import styles from "./club-map.module.css";

export interface MapPin {
  id: string;
  slug: string;
  name: string;
  citySlug: string;
  lat: number;
  lng: number;
  minPrice: number | null;
}

const venueIcon = L.divIcon({
  className: styles.marker,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -32],
});

function MapViewport({ pins, center, zoom }: {
  pins: MapPin[];
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  const [lat, lng] = center;

  useEffect(() => {
    if (pins.length > 1) {
      map.fitBounds(pins.map((pin) => [pin.lat, pin.lng]), {
        padding: [32, 42],
        maxZoom: 15,
        animate: false,
      });
    } else {
      const pin = pins[0];
      map.setView(pin ? [pin.lat, pin.lng] : [lat, lng], pin ? Math.max(zoom, 15) : zoom, {
        animate: false,
      });
    }

    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, pins, lat, lng, zoom]);

  return null;
}

export default function ClubMap({
  pins,
  center,
  zoom = 12,
  height = "420px",
}: {
  pins: MapPin[];
  center: [number, number];
  zoom?: number;
  height?: string;
}) {
  const mappedPins = pins.filter(({ lat, lng }) =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );

  const locations = new Map<string, MapPin[]>();
  for (const pin of mappedPins) {
    const key = `${pin.lat},${pin.lng}`;
    const venues = locations.get(key);
    if (venues) venues.push(pin);
    else locations.set(key, [pin]);
  }

  return (
    <div className="isolate overflow-hidden rounded-xl border border-line bg-night-raised">
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
        <span className="font-semibold">Venue map</span>
        <span className="text-xs text-moon-dim">
          {mappedPins.length === 0 ? "No mapped venues" : `${mappedPins.length} venue${mappedPins.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={3}
        maxZoom={19}
        style={{ height, width: "100%", background: "#dce3e8" }}
        scrollWheelZoom={false}
        className={styles.map}
      >
        <MapViewport pins={mappedPins} center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {[...locations].map(([location, venues]) => {
          const { lat, lng } = venues[0];
          const title = venues.map((venue) => venue.name).join(", ");
          return (
            <Marker
              key={location}
              position={[lat, lng]}
              icon={venueIcon}
              title={title}
              alt={title}
              eventHandlers={{
                add: (event) => event.target.getElement()?.setAttribute("aria-label", title),
              }}
            >
              <Popup>
                {venues.map((venue) => (
                  <div className={styles.popup} key={venue.id}>
                    <strong>{venue.name}</strong>
                    {venue.minPrice !== null && (
                      <span>{venue.minPrice === 0 ? "Free entry" : `Entry from ${formatPaise(venue.minPrice)}`}</span>
                    )}
                    <div className={styles.actions}>
                      <Link href={`/${venue.citySlug}/clubs/${venue.slug}`}>View club</Link>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Directions
                      </a>
                    </div>
                  </div>
                ))}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

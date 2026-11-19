"use client";

import { useEffect } from "react";

export function VenueIntent({ clubId, date }: { clubId: string; date: string }) {
  useEffect(() => {
    if (clubId.startsWith("demo-")) return;
    function record() {
      try {
        if (localStorage.getItem("tml_cookie_consent") !== "accepted") return;
        const key = "tml_venue_visit";
        const visitKey = sessionStorage.getItem(key) ?? crypto.randomUUID();
        sessionStorage.setItem(key, visitKey);
        void fetch("/api/venue-intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clubId, date, visitKey }),
        }).catch(() => {});
      } catch {
        // A browser without storage can still browse and book.
      }
    }
    record();
    window.addEventListener("thirtyml:consent-granted", record);
    return () => window.removeEventListener("thirtyml:consent-granted", record);
  }, [clubId, date]);
  return null;
}

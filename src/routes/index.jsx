import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchPharmacies } from "@/lib/pharmacies.functions";

export const Route = createFileRoute("/")({
  component: Home,
});

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

let mapsLoader = null;
function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    if (!BROWSER_KEY) {
      reject(new Error("Missing Google Maps browser key"));
      return;
    }
    window.__initMedNearMap = () => resolve();
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      callback: "__initMedNearMap",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsLoader;
}

function formatDistance(m) {
  if (m == null) return "";
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function buildGoogleMapsSearchUrl(coords) {
  const query = coords ? `pharmacies near ${coords.lat},${coords.lng}` : "pharmacies near me";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildGoogleMapsDirectionsUrl(pharmacy) {
  const destination = pharmacy.location
    ? `${pharmacy.location.lat},${pharmacy.location.lng}`
    : `${pharmacy.name} ${pharmacy.address}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

function Home() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locError, setLocError] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [radius, setRadius] = useState(5000);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const infoRef = useRef(null);

  const findSearchFn = useServerFn(searchPharmacies);

  // Med autocomplete via RxNorm (public, no auth)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=8`,
          { signal: ctrl.signal },
        );
        const json = await res.json();
        const cands = json?.approximateGroup?.candidate ?? [];
        const seen = new Set();
        const items = [];
        for (const c of cands) {
          if (!c.name) continue;
          const key = c.name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({ name: c.name, rxcui: c.rxcui });
          if (items.length >= 6) break;
        }
        setSuggestions(items);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  // Get user location on mount
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setLocError(err.message || "Unable to get your location."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Init map once we have coords
  useEffect(() => {
    if (!coords || !mapRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current || !window.google) return;
        if (!mapInstance.current) {
          mapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: coords,
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: true,
            clickableIcons: false,
            styles: [
              { featureType: "poi", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] },
            ],
          });
          infoRef.current = new window.google.maps.InfoWindow();
        } else {
          mapInstance.current.setCenter(coords);
        }
        if (userMarkerRef.current) userMarkerRef.current.setMap(null);
        userMarkerRef.current = new window.google.maps.Marker({
          position: coords,
          map: mapInstance.current,
          title: "You are here",
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#0ea5a4",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
      })
      .catch((e) => setLocError(e.message));
    return () => {
      cancelled = true;
    };
  }, [coords]);

  // Render pharmacy markers when list changes
  useEffect(() => {
    if (!mapInstance.current || !window.google) return;
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];
    if (pharmacies.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    if (coords) bounds.extend(coords);
    pharmacies.forEach((p, i) => {
      const marker = new window.google.maps.Marker({
        position: p.location,
        map: mapInstance.current,
        title: p.name,
        label: {
          text: String(i + 1),
          color: "#ffffff",
          fontSize: "12px",
          fontWeight: "600",
        },
      });
      marker.addListener("click", () => {
        setActiveId(p.id);
        const content = `
          <div style="font-family: system-ui; max-width: 220px;">
            <div style="font-weight:600; margin-bottom:2px;">${escapeHtml(p.name)}</div>
            <div style="font-size:12px; color:#555;">${escapeHtml(p.address)}</div>
            ${p.phone ? `<div style="font-size:12px; margin-top:4px;"><a href="tel:${escapeHtml(p.phone)}">${escapeHtml(p.phone)}</a></div>` : ""}
          </div>`;
        infoRef.current.setContent(content);
        infoRef.current.open({ anchor: marker, map: mapInstance.current });
      });
      markersRef.current.push(marker);
      bounds.extend(p.location);
    });
    mapInstance.current.fitBounds(bounds, 60);
  }, [pharmacies, coords]);

  async function runSearch(med) {
    if (!coords) {
      setLocError("We need your location to find pharmacies. Please allow location access.");
      return;
    }
    setSelectedMed(med);
    setShowSuggestions(false);
    setLoading(true);
    try {
      const result = await findSearchFn({
        data: { lat: coords.lat, lng: coords.lng, radius, keyword: med },
      });
      setPharmacies(result.pharmacies);
      if (result.pharmacies.length === 0) {
        setLocError("No pharmacies found in this area. Try increasing the radius.");
      } else {
        setLocError(null);
      }
    } catch (e) {
      setLocError(e?.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  }

  const canSearch = useMemo(() => !!coords && query.trim().length > 0, [coords, query]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">
            +
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">MedNear</h1>
            <p className="text-xs text-muted-foreground">
              Search a medication, find pharmacies near you
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">
        <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) runSearch(query.trim());
                }}
                placeholder="Search a medication (e.g. ibuprofen, metformin)"
                className="w-full h-12 rounded-xl border bg-background px-4 pr-10 outline-none focus:ring-2 focus:ring-ring transition"
                aria-label="Medication name"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                🔎
              </span>
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full bg-card border rounded-xl shadow-soft overflow-hidden">
                  {suggestions.map((s) => (
                    <li key={s.name}>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(s.name);
                          runSearch(s.name);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground text-sm capitalize"
                      >
                        {s.name.toLowerCase()}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="h-12 rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
              aria-label="Search radius"
            >
              <option value={1000}>1 km</option>
              <option value={2000}>2 km</option>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
              <option value={20000}>20 km</option>
            </select>
            <button
              type="button"
              disabled={!canSearch || loading}
              onClick={() => runSearch(query.trim())}
              className="h-12 rounded-xl px-6 bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:opacity-95 transition"
            >
              {loading ? "Searching…" : "Find pharmacies"}
            </button>
            <a
              href={buildGoogleMapsSearchUrl(coords)}
              target="_blank"
              rel="noreferrer"
              className="h-12 rounded-xl px-5 border bg-background text-foreground font-medium hover:bg-accent transition inline-flex items-center justify-center text-center"
            >
              Open in Google Maps
            </a>
          </div>

          {selectedMed && (
            <p className="mt-3 text-sm text-muted-foreground">
              Showing pharmacies near you for{" "}
              <span className="font-medium text-foreground capitalize">
                {selectedMed.toLowerCase()}
              </span>
              . Call ahead to confirm stock.
            </p>
          )}
          {locError && (
            <p className="mt-3 text-sm text-warning-foreground bg-accent border border-border rounded-lg px-3 py-2">
              {locError}
            </p>
          )}
        </section>

        <section className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-card rounded-2xl border shadow-soft overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="font-semibold">
                  {pharmacies.length > 0 ? `${pharmacies.length} pharmacies` : "Nearby pharmacies"}
                </h2>
                {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
              </div>
              <ul className="max-h-[560px] overflow-y-auto divide-y">
                {pharmacies.length === 0 && !loading && (
                  <li className="px-4 py-8 text-sm text-muted-foreground text-center">
                    Search a medication to see nearby pharmacies.
                  </li>
                )}
                {pharmacies.map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveId(p.id);
                        if (mapInstance.current) {
                          mapInstance.current.panTo(p.location);
                          mapInstance.current.setZoom(15);
                          const marker = markersRef.current[i];
                          if (marker && infoRef.current) {
                            infoRef.current.setContent(
                              `<div style="font-family:system-ui;max-width:220px;">
                                <div style="font-weight:600;">${escapeHtml(p.name)}</div>
                                <div style="font-size:12px;color:#555;">${escapeHtml(p.address)}</div>
                              </div>`,
                            );
                            infoRef.current.open({
                              anchor: marker,
                              map: mapInstance.current,
                            });
                          }
                        }
                      }}
                      className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-accent/50 transition ${
                        activeId === p.id ? "bg-accent/60" : ""
                      }`}
                    >
                      <div className="mt-0.5 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs grid place-items-center font-semibold shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground shrink-0">
                            {formatDistance(p.distanceMeters)}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{p.address}</div>
                        <div className="mt-1 flex items-center gap-3 text-xs">
                          {p.rating != null && (
                            <span className="text-foreground">
                              ★ {p.rating.toFixed(1)}
                              {p.userRatingCount ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  ({p.userRatingCount})
                                </span>
                              ) : null}
                            </span>
                          )}
                          {p.openNow != null && (
                            <span
                              className={
                                p.openNow ? "text-[color:var(--success)]" : "text-muted-foreground"
                              }
                            >
                              {p.openNow ? "Open now" : "Closed"}
                            </span>
                          )}
                          {p.phone && (
                            <a
                              href={`tel:${p.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline"
                            >
                              Call
                            </a>
                          )}
                          <a
                            href={buildGoogleMapsDirectionsUrl(p)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline"
                          >
                            Directions
                          </a>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-card rounded-2xl border shadow-soft overflow-hidden">
              <div
                ref={mapRef}
                className="w-full h-[420px] lg:h-[600px] bg-muted"
                aria-label="Map of nearby pharmacies"
              />
              {!coords && !locError && (
                <div className="p-4 text-sm text-muted-foreground">Requesting your location…</div>
              )}
            </div>
          </div>
        </section>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Medication names from the U.S. National Library of Medicine (RxNorm). Pharmacy locations
          from Google Maps. Stock availability is not guaranteed — please call the pharmacy to
          confirm.
        </p>
      </main>
    </div>
  );
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

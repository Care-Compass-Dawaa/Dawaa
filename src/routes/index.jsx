import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import { searchPharmacies } from "@/lib/pharmacies.functions";
import { getSession, logout } from "@/lib/auth";

// Leaflet's default icon images are loaded from a CDN path that breaks with
// bundlers. We inline the SVGs instead.
delete L.Icon.Default.prototype._getIconUrl;

export const Route = createFileRoute("/")({
  component: Home,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAP_PIN_COLOR  = "#7547d8";
const MAP_PIN_DARK   = "#5b2fc7";
const MAP_PIN_LIGHT  = "#f5f0ff";
const BEIRUT_CENTER  = { lat: 33.8938, lng: 35.5018 }; // fallback if geolocation denied

// ---------------------------------------------------------------------------
// Custom Leaflet icons (SVG, no external image files needed)
// ---------------------------------------------------------------------------
function makePharmacyIcon(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
    <path fill="${MAP_PIN_COLOR}" stroke="${MAP_PIN_DARK}" stroke-width="2"
          d="M20 46S6 29.7 6 18A14 14 0 1 1 34 18C34 29.7 20 46 20 46Z"/>
    <circle cx="20" cy="18" r="8.5" fill="${MAP_PIN_LIGHT}"/>
    <path fill="${MAP_PIN_COLOR}" d="M18.4 13.5h3.2v3h3v3.1h-3v3h-3.2v-3h-3v-3.1h3z"/>
    <text x="20" y="22" text-anchor="middle" fill="${MAP_PIN_COLOR}"
          font-size="9" font-weight="700" font-family="system-ui">${label}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize:   [34, 41],
    iconAnchor: [17, 41],
    popupAnchor:[0, -38],
  });
}

const USER_ICON = L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;
                background:${MAP_PIN_COLOR};border:3px solid #fff;
                box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  className: "",
  iconSize:   [16, 16],
  iconAnchor: [8, 8],
});

// ---------------------------------------------------------------------------
// Helper: recenter + zoom map when coords / pharmacies change
// ---------------------------------------------------------------------------
function MapController({ coords, pharmacies }) {
  const map = useMap();
  useEffect(() => {
    if (!coords) return;
    if (pharmacies.length === 0) {
      map.setView([coords.lat, coords.lng], 13);
      return;
    }
    const points = [
      [coords.lat, coords.lng],
      ...pharmacies.map((p) => [p.location.lat, p.location.lng]),
    ];
    map.fitBounds(points, { padding: [40, 40] });
  }, [coords, pharmacies, map]);
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDistance(m) {
  if (m == null) return "";
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function osmDirectionsUrl(pharmacy) {
  const { lat, lng } = pharmacy.location;
  return `https://www.openstreetmap.org/directions?to=${lat},${lng}`;
}

// ---------------------------------------------------------------------------
// Home component
// ---------------------------------------------------------------------------
function Home() {
  const navigate  = useNavigate();
  const session   = getSession();

  const [query, setQuery]               = useState("");
  const [suggestions, setSuggestions]   = useState([]);
  const [showSuggestions, setShowSugg]  = useState(false);
  const [selectedMed, setSelectedMed]   = useState(null);
  const [coords, setCoords]             = useState(null);
  const [locError, setLocError]         = useState(null);
  const [pharmacies, setPharmacies]     = useState([]);
  const [loading, setLoading]           = useState(false);
  const [activeId, setActiveId]         = useState(null);
  const [radius, setRadius]             = useState(5000);
  const [showOpenOnly, setShowOpenOnly] = useState(false);

  const markerRefs = useRef({});
  const findSearchFn = useServerFn(searchPharmacies);

  // ── Medication autocomplete via RxNorm ──────────────────────────────────
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(
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
      } catch { /* ignore abort */ }
    }, 200);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [query]);

  // ── Geolocation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocError("Geolocation not supported — showing Beirut.");
      setCoords(BEIRUT_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setLocError("Location access denied — showing Beirut.");
        setCoords(BEIRUT_CENTER);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // ── Search ───────────────────────────────────────────────────────────────
  async function runSearch(med) {
    if (!coords) { setLocError("Still waiting for your location…"); return; }
    setSelectedMed(med);
    setShowSugg(false);
    setLoading(true);
    try {
      const result = await findSearchFn({
        data: { lat: coords.lat, lng: coords.lng, radius, keyword: med },
      });
      setPharmacies(result.pharmacies ?? []);
      setLocError(result.pharmacies?.length === 0
        ? "No pharmacies found. Try a wider radius."
        : null);
    } catch (e) {
      setLocError(e?.message ?? "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  // ── Open/closed filter ───────────────────────────────────────────────────
  const visiblePharmacies = useMemo(
    () => showOpenOnly ? pharmacies.filter((p) => p.openNow === true) : pharmacies,
    [pharmacies, showOpenOnly],
  );

  const canSearch = useMemo(() => !!coords && query.trim().length > 0, [coords, query]);
  const mapCenter = coords ?? BEIRUT_CENTER;

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ── */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold shrink-0">
            +
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Dawaa</h1>
            <p className="text-xs text-muted-foreground truncate">
              Search a medication, find pharmacies near you
            </p>
          </div>

          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:block">
                {session.name} · <span className="capitalize">{session.role}</span>
              </span>
              {session.role === "pharmacist" && (
                <Link to="/pharmacist"
                  className="text-sm font-medium px-4 py-2 rounded-xl border bg-background hover:bg-accent transition">
                  Dashboard
                </Link>
              )}
              {session.role === "admin" && (
                <Link to="/admin"
                  className="text-sm font-medium px-4 py-2 rounded-xl border bg-background hover:bg-accent transition">
                  Admin
                </Link>
              )}
              <button
                onClick={() => { logout(); navigate({ to: "/login", replace: true }); }}
                className="text-sm text-red-500 hover:underline"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/login"
              className="text-sm font-medium px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">

        {/* ── Search bar ── */}
        <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">

            {/* Medication input + autocomplete */}
            <div className="relative flex-1">
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSugg(true); }}
                onFocus={() => setShowSugg(true)}
                onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) runSearch(query.trim()); }}
                placeholder="Search a medication (e.g. ibuprofen, panadol)"
                className="w-full h-12 rounded-xl border bg-background px-4 pr-10 outline-none focus:ring-2 focus:ring-ring transition"
                aria-label="Medication name"
                aria-autocomplete="list"
                aria-expanded={showSuggestions && suggestions.length > 0}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">🔎</span>
              {showSuggestions && suggestions.length > 0 && (
                <ul role="listbox" className="absolute z-20 mt-1 w-full bg-card border rounded-xl shadow-soft overflow-hidden">
                  {suggestions.map((s) => (
                    <li key={s.name} role="option">
                      <button type="button"
                        onClick={() => { setQuery(s.name); runSearch(s.name); }}
                        className="w-full text-left px-4 py-2 hover:bg-accent text-sm capitalize">
                        {s.name.toLowerCase()}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Radius */}
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}
              className="h-12 rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
              aria-label="Search radius">
              <option value={1000}>1 km</option>
              <option value={2000}>2 km</option>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
              <option value={20000}>20 km</option>
            </select>

            {/* Search button */}
            <button type="button" disabled={!canSearch || loading}
              onClick={() => runSearch(query.trim())}
              className="h-12 rounded-xl px-6 bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:opacity-95 transition">
              {loading ? "Searching…" : "Find pharmacies"}
            </button>
          </div>

          {/* Open-only filter */}
          <div className="mt-3 flex items-center gap-2">
            <input id="open-only" type="checkbox" checked={showOpenOnly}
              onChange={(e) => setShowOpenOnly(e.target.checked)}
              className="h-4 w-4 rounded border accent-primary" />
            <label htmlFor="open-only" className="text-sm cursor-pointer select-none">
              Show open pharmacies only
            </label>
          </div>

          {selectedMed && (
            <p className="mt-2 text-sm text-muted-foreground">
              Showing pharmacies near you for{" "}
              <span className="font-medium text-foreground capitalize">{selectedMed.toLowerCase()}</span>.
              Call ahead to confirm stock.
            </p>
          )}
          {locError && (
            <p className="mt-2 text-sm bg-accent border border-border rounded-lg px-3 py-2">
              {locError}
            </p>
          )}
        </section>

        {/* ── Results grid ── */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Pharmacy list */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-card rounded-2xl border shadow-soft overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="font-semibold">
                  {visiblePharmacies.length > 0
                    ? `${visiblePharmacies.length} pharmacie${visiblePharmacies.length > 1 ? "s" : ""}`
                    : "Nearby pharmacies"}
                </h2>
                {loading && <span className="text-xs text-muted-foreground animate-pulse">Searching…</span>}
              </div>
              <ul className="max-h-[560px] overflow-y-auto divide-y">
                {visiblePharmacies.length === 0 && !loading && (
                  <li className="px-4 py-8 text-sm text-muted-foreground text-center">
                    {pharmacies.length > 0
                      ? "No open pharmacies — uncheck the filter to see all."
                      : "Search a medication to see nearby pharmacies."}
                  </li>
                )}
                {visiblePharmacies.map((p, i) => (
                  <li key={p.id}>
                    <button type="button"
                      onClick={() => {
                        setActiveId(p.id);
                        markerRefs.current[p.id]?.openPopup();
                      }}
                      className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-accent/50 transition ${activeId === p.id ? "bg-accent/60" : ""}`}
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
                            <span>★ {p.rating.toFixed(1)}
                              {p.userRatingCount
                                ? <span className="text-muted-foreground"> ({p.userRatingCount})</span>
                                : null}
                            </span>
                          )}
                          {p.openNow != null && (
                            <span className={p.openNow ? "text-[color:var(--success)]" : "text-muted-foreground"}>
                              {p.openNow ? "Open now" : "Closed"}
                            </span>
                          )}
                          {p.phone && (
                            <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline">Call</a>
                          )}
                          <a href={osmDirectionsUrl(p)} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline">Directions</a>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-card rounded-2xl border shadow-soft overflow-hidden">
              <MapContainer
                center={[mapCenter.lat, mapCenter.lng]}
                zoom={13}
                className="w-full h-[420px] lg:h-[600px]"
                aria-label="Map of nearby pharmacies"
                zoomControl={true}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                <MapController coords={coords} pharmacies={visiblePharmacies} />

                {/* User location marker + accuracy circle */}
                {coords && (
                  <>
                    <Marker position={[coords.lat, coords.lng]} icon={USER_ICON}>
                      <Popup>You are here</Popup>
                    </Marker>
                    <Circle
                      center={[coords.lat, coords.lng]}
                      radius={radius}
                      pathOptions={{ color: MAP_PIN_COLOR, fillColor: MAP_PIN_COLOR, fillOpacity: 0.05, weight: 1 }}
                    />
                  </>
                )}

                {/* Pharmacy markers */}
                {visiblePharmacies.map((p, i) => (
                  <Marker
                    key={p.id}
                    position={[p.location.lat, p.location.lng]}
                    icon={makePharmacyIcon(i + 1)}
                    ref={(ref) => { if (ref) markerRefs.current[p.id] = ref; }}
                    eventHandlers={{ click: () => setActiveId(p.id) }}
                  >
                    <Popup>
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{p.address}</div>
                      {p.phone && (
                        <a href={`tel:${p.phone}`} className="text-xs text-primary mt-1 block">
                          {p.phone}
                        </a>
                      )}
                      {p.openNow != null && (
                        <div className={`text-xs mt-1 font-medium ${p.openNow ? "text-green-600" : "text-gray-400"}`}>
                          {p.openNow ? "Open now" : "Closed"}
                        </div>
                      )}
                      <a href={osmDirectionsUrl(p)} target="_blank" rel="noreferrer"
                        className="text-xs text-primary hover:underline mt-1 block">
                        Get directions →
                      </a>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </section>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Medication suggestions from the U.S. National Library of Medicine (RxNorm).
          Map tiles © <a href="https://www.openstreetmap.org/copyright" className="hover:underline" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors.
          Call the pharmacy to confirm stock availability.
        </p>
      </main>
    </div>
  );
}

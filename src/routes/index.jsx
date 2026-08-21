import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  List as ListIcon,
  Mail,
  MapPin,
  MapPinCheck,
  Phone,
  Pill,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  loginUser,
  registerUser,
  getInventory,
  upsertInventoryItem,
  deleteInventoryItem,
  getAllUsers,
  getAllPharmacies,
  approvePharmacy,
  registerPharmacy,
  getMyPharmacy,
  searchPharmacies,
} from "@/lib/pharmacies.functions";

export const Route = createFileRoute("/")({
  component: Home,
});

// ─── Auth Context ──────────────────────────────────────────────────────────────
function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("dawaa_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  function login(userData) {
    localStorage.setItem("dawaa_user", JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("dawaa_user");
    setUser(null);
  }

  return { user, login, logout };
}

// ─── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({ onClose, onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("patient");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const loginFn = useServerFn(loginUser);
  const registerFn = useServerFn(registerUser);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let result;
      if (mode === "login") {
        result = await loginFn({ data: { email, password } });
      } else {
        result = await registerFn({ data: { email, password, name, role } });
      }
      onLogin(result.user);
      onClose();
    } catch (err) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border shadow-soft w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">
            {mode === "login" ? "Sign in to Dawaa" : "Create an account"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === "login" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === "register" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "register" && (
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          )}
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          {mode === "register" && (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="patient">Patient / Caregiver</option>
              <option value="pharmacist">Pharmacy Staff</option>
            </select>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:opacity-95 transition text-sm mt-1"
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Pharmacy Setup Screen ─────────────────────────────────────────────────────
function PharmacySetup({ user, onComplete }) {
  const [form, setForm] = useState({ name: "", address: "", area: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const registerPharmacyFn = useServerFn(registerPharmacy);

  const LEBANON_AREAS = [
    "Beirut",
    "Tripoli",
    "Sidon",
    "Tyre",
    "Jounieh",
    "Baalbek",
    "Zahle",
    "Nabatieh",
    "Byblos",
    "Aley",
    "Batroun",
    "Jbeil",
    "Chouf",
    "Metn",
    "Kesrouan",
    "Akkar",
    "Hermel",
    "Other",
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await registerPharmacyFn({
        data: { pharmacistId: user.id, ...form },
      });
      onComplete(result.pharmacy);
    } catch (err) {
      setError(err?.message ?? "Failed to register pharmacy");
    } finally {
      setSaving(false);
    }
  }

  function field(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress indicator */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs grid place-items-center font-semibold">
            1
          </div>
          <span className="text-sm font-medium">Pharmacy profile</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground text-xs grid place-items-center font-semibold">
            2
          </div>
          <span className="text-sm text-muted-foreground">Manage inventory</span>
        </div>
      </div>

      <div className="bg-card rounded-2xl border shadow-soft p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center text-xl">
            🏥
          </div>
          <div>
            <h2 className="text-lg font-semibold">Register your pharmacy</h2>
            <p className="text-xs text-muted-foreground">
              This lets patients find your pharmacy when searching for medication.
            </p>
          </div>
        </div>

        <div className="h-px bg-border my-5" />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Pharmacy name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Pharmacy name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={field("name")}
              placeholder="e.g. Al Shifa Pharmacy"
              className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          {/* Area */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Area / Region <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.area}
              onChange={field("area")}
              className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="">Select area…</option>
              {LEBANON_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Street address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Street address <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.address}
              onChange={field("address")}
              placeholder="e.g. Main Street, next to the municipality"
              className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Phone number <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="tel"
              value={form.phone}
              onChange={field("phone")}
              placeholder="e.g. +961 1 234 567"
              className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="h-px bg-border" />

          {/* Approval notice */}
          <div className="flex gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2.5">
            <span className="shrink-0">ℹ️</span>
            <span>
              Your pharmacy will be visible to patients after an admin reviews and approves your
              registration.
            </span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:opacity-95 transition text-sm"
          >
            {saving ? "Submitting…" : "Submit pharmacy profile →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Pharmacist Dashboard ──────────────────────────────────────────────────────
function PharmacistDashboard({ user }) {
  const [pharmacy, setPharmacy] = useState(null);
  const [checkingPharmacy, setCheckingPharmacy] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ medicineName: "", quantity: "", inStock: true, editId: null });
  const [saving, setSaving] = useState(false);

  const getMyPharmacyFn = useServerFn(getMyPharmacy);
  const getInventoryFn = useServerFn(getInventory);
  const upsertFn = useServerFn(upsertInventoryItem);
  const deleteFn = useServerFn(deleteInventoryItem);

  // On mount, check if this pharmacist has a registered pharmacy
  useEffect(() => {
    getMyPharmacyFn({ data: { pharmacistId: user.id } })
      .then((res) => setPharmacy(res.pharmacy))
      .catch(() => setPharmacy(null))
      .finally(() => setCheckingPharmacy(false));
  }, []);

  // Load inventory once pharmacy is confirmed
  useEffect(() => {
    if (pharmacy) loadInventory();
  }, [pharmacy]);

  async function loadInventory() {
    setLoading(true);
    setError(null);
    try {
      const result = await getInventoryFn({ data: { pharmacistId: user.id } });
      setInventory(result.items);
    } catch (err) {
      setError(err?.message ?? "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.medicineName.trim()) return;
    setSaving(true);
    try {
      await upsertFn({
        data: {
          pharmacistId: user.id,
          id: form.editId,
          medicineName: form.medicineName.trim(),
          quantity: Number(form.quantity) || 0,
          inStock: form.inStock,
        },
      });
      setForm({ medicineName: "", quantity: "", inStock: true, editId: null });
      await loadInventory();
    } catch (err) {
      setError(err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Remove this medicine from your inventory?")) return;
    try {
      await deleteFn({ data: { pharmacistId: user.id, id } });
      await loadInventory();
    } catch (err) {
      setError(err?.message ?? "Failed to delete");
    }
  }

  function startEdit(item) {
    setForm({
      medicineName: item.medicineName,
      quantity: item.quantity,
      inStock: item.inStock,
      editId: item.id,
    });
  }

  // Still loading pharmacy check
  if (checkingPharmacy) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // No pharmacy yet — show the setup screen
  if (!pharmacy) {
    return <PharmacySetup user={user} onComplete={(p) => setPharmacy(p)} />;
  }

  // Has pharmacy — show inventory dashboard
  return (
    <div className="max-w-3xl mx-auto">
      {/* Pharmacy profile card */}
      <div className="bg-card rounded-2xl border shadow-soft p-4 mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center text-xl shrink-0">
            🏥
          </div>
          <div>
            <div className="font-semibold">{pharmacy.name}</div>
            <div className="text-xs text-muted-foreground">
              {pharmacy.area} · {pharmacy.address} · {pharmacy.phone}
            </div>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${pharmacy.approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
        >
          {pharmacy.approved ? "Approved" : "Pending approval"}
        </span>
      </div>

      <h2 className="text-xl font-semibold mb-2">Pharmacy Inventory</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Manage the medicines available at your pharmacy. Patients rely on this information to find
        their medication.
      </p>

      <div className="bg-card rounded-2xl border shadow-soft p-5 mb-6">
        <h3 className="font-medium mb-3">{form.editId ? "Edit medicine" : "Add medicine"}</h3>
        <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-3">
          <input
            required
            value={form.medicineName}
            onChange={(e) => setForm((f) => ({ ...f, medicineName: e.target.value }))}
            placeholder="Medicine name (brand or generic)"
            className="flex-1 h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <input
            type="number"
            min="0"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            placeholder="Qty"
            className="w-24 h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.inStock}
              onChange={(e) => setForm((f) => ({ ...f, inStock: e.target.checked }))}
              className="rounded"
            />
            In stock
          </label>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-xl px-5 bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:opacity-95 transition text-sm"
          >
            {saving ? "Saving…" : form.editId ? "Update" : "Add"}
          </button>
          {form.editId && (
            <button
              type="button"
              onClick={() =>
                setForm({ medicineName: "", quantity: "", inStock: true, editId: null })
              }
              className="h-11 rounded-xl px-4 border text-sm hover:bg-accent transition"
            >
              Cancel
            </button>
          )}
        </form>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="bg-card rounded-2xl border shadow-soft overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <span className="font-medium">Current inventory</span>
          {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
        </div>
        {inventory.length === 0 && !loading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            No medicines added yet.
          </p>
        ) : (
          <ul className="divide-y">
            {inventory.map((item) => (
              <li key={item.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.medicineName}</div>
                  <div className="text-xs text-muted-foreground">
                    Qty: {item.quantity} · Updated: {new Date(item.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${item.inStock ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}
                >
                  {item.inStock ? "In stock" : "Out of stock"}
                </span>
                <button
                  onClick={() => startEdit(item)}
                  className="text-xs text-primary hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [tab, setTab] = useState("users");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getUsersFn = useServerFn(getAllUsers);
  const getPharmaciesFn = useServerFn(getAllPharmacies);
  const approveFn = useServerFn(approvePharmacy);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [uRes, pRes] = await Promise.all([
        getUsersFn({ data: {} }),
        getPharmaciesFn({ data: {} }),
      ]);
      setUsers(uRes.users);
      setPharmacies(pRes.pharmacies);
    } catch (err) {
      setError(err?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(pharmacyId, approved) {
    try {
      await approveFn({ data: { pharmacyId, approved } });
      await loadData();
    } catch (err) {
      setError(err?.message ?? "Failed to update pharmacy");
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Admin Panel</h2>
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="flex gap-2 mb-5">
        {["users", "pharmacies"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            {t} {t === "users" ? `(${users.length})` : `(${pharmacies.length})`}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {tab === "users" && (
        <div className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b font-medium">Registered users</div>
          {users.length === 0 && !loading ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">No users yet.</p>
          ) : (
            <ul className="divide-y">
              {users.map((u) => (
                <li key={u.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">
                    {u.role}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Joined {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "pharmacies" && (
        <div className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b font-medium">Registered pharmacies</div>
          {pharmacies.length === 0 && !loading ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              No pharmacies yet.
            </p>
          ) : (
            <ul className="divide-y">
              {pharmacies.map((p) => (
                <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.address}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${p.approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                  >
                    {p.approved ? "Approved" : "Pending"}
                  </span>
                  {!p.approved && (
                    <button
                      onClick={() => handleApprove(p.id, true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Approve
                    </button>
                  )}
                  {p.approved && (
                    <button
                      onClick={() => handleApprove(p.id, false)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────────────────
function closestDistance(pharmacy) {
  return pharmacy?.distanceMeters ?? pharmacy?.distance ?? 0;
}

function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return "Distance unavailable";
  }
  if (distanceMeters < 1000) {
    return `${Math.max(0, Math.round(distanceMeters))} m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function pharmacyLatLng(pharmacy) {
  if (pharmacy?.location && Number.isFinite(pharmacy.location.lat) && Number.isFinite(pharmacy.location.lng)) {
    return { lat: pharmacy.location.lat, lng: pharmacy.location.lng };
  }
  if (Number.isFinite(pharmacy?.latitude) && Number.isFinite(pharmacy?.longitude)) {
    return { lat: pharmacy.latitude, lng: pharmacy.longitude };
  }
  return null;
}

// ─── Leaflet (OpenStreetMap) loader — loaded on demand, client-side only ───────
let leafletPromise = null;
function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    const cssHref = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    if (!document.querySelector(`link[href="${cssHref}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssHref;
      document.head.appendChild(link);
    }

    const src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.L) return resolve(window.L);
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", () => reject(new Error("Failed to load map")));
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Failed to load map"));
    document.head.appendChild(script);
  });

  return leafletPromise;
}

// ─── Pharmacy map (OpenStreetMap via Leaflet) ──────────────────────────────────
function PharmacyMap({
  userLocation,
  pharmacies,
  selectedId,
  onSelect,
  className = "",
  showLegend = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([33.8938, 35.5018], 8); // Beirut, Lebanon default

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        mapRef.current = map;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.L) return;
    const L = window.L;
    const map = mapRef.current;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const bounds = [];

    if (userLocation) {
      const icon = L.divIcon({
        className: "",
        html:
          '<div style="width:16px;height:16px;border-radius:9999px;background:#7c3aed;' +
          'border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const marker = L.marker([userLocation.lat, userLocation.lng], { icon, zIndexOffset: 500 }).addTo(map);
      markersRef.current.push(marker);
      bounds.push([userLocation.lat, userLocation.lng]);
    }

    pharmacies.forEach((pharmacy, idx) => {
      const loc = pharmacyLatLng(pharmacy);
      if (!loc) return;
      const isNearest = idx === 0;
      const isSelected = pharmacy.id === selectedId;
      const bg = isNearest ? "#f97316" : "#7c3aed";
      const ring = isSelected ? "0 0 0 4px rgba(124,58,237,0.30), " : "";
      const icon = L.divIcon({
        className: "",
        html:
          `<div style="width:28px;height:28px;border-radius:9999px;background:${bg};color:#fff;` +
          `display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;` +
          `border:2px solid white;box-shadow:${ring}0 2px 6px rgba(0,0,0,.3)">${idx + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);
      marker.on("click", () => onSelect?.(pharmacy.id));
      markersRef.current.push(marker);
      bounds.push([loc.lat, loc.lng]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [48, 48] });
    }
  }, [ready, userLocation, pharmacies, selectedId, onSelect]);

  return (
    <div className={`relative isolate overflow-hidden rounded-2xl border bg-muted ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {!ready && !failed && (
        <div className="absolute inset-0 grid place-items-center bg-muted text-sm text-muted-foreground">
          Loading map…
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-muted px-6 text-center text-sm text-muted-foreground">
          Couldn't load the map. Check your connection and try again.
        </div>
      )}
      {ready && showLegend && (
        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-card/90 px-3 py-1.5 text-[11px] shadow-soft backdrop-blur">
          <LegendDot color="#7c3aed" label="Your location" />
          <LegendDot color="#f97316" label="Nearest" />
          <LegendDot color="#7c3aed" label="Pharmacy" outline />
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label, outline = false }) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <span
        className="h-2 w-2 rounded-full"
        style={{
          backgroundColor: outline ? "transparent" : color,
          border: outline ? `1.5px solid ${color}` : "none",
        }}
      />
      {label}
    </span>
  );
}

// ─── Pharmacy list row ──────────────────────────────────────────────────────────
function PharmacyListItem({ pharmacy, rank, active, onClick }) {
  const hasQty = pharmacy.hasAvailabilityData && Number.isFinite(pharmacy.availableQuantity);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-accent/60 ${active ? "bg-accent/70" : ""}`}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{pharmacy.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {pharmacy.area || pharmacy.address || "Lebanon"}
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold">
            {formatDistance(closestDistance(pharmacy))}
          </span>
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          {hasQty ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
              {pharmacy.availableQuantity} available
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Availability unknown
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">
            {pharmacy.availabilityUpdatedAt
              ? `Updated ${new Date(pharmacy.availabilityUpdatedAt).toLocaleDateString()}`
              : "Updated today"}
          </span>
        </span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

// ─── Pharmacy detail page ──────────────────────────────────────────────────────
function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="break-words text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function PharmacyDetailPage({ pharmacy, medicine }) {
  const loc = pharmacyLatLng(pharmacy);
  const hasQty = pharmacy.hasAvailabilityData && Number.isFinite(pharmacy.availableQuantity);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{pharmacy.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pharmacy.area || pharmacy.address || "Lebanon"}
          </p>
        </div>
        {Number.isFinite(closestDistance(pharmacy)) && closestDistance(pharmacy) > 0 && (
          <span className="shrink-0 text-sm font-semibold text-primary">
            {formatDistance(closestDistance(pharmacy))}
          </span>
        )}
      </div>

      <div className="space-y-5 p-5">
        {medicine && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                Availability for {medicine.brandName}
              </div>
              <div
                className={`text-sm font-semibold ${hasQty ? "text-green-700" : "text-muted-foreground"}`}
              >
                {hasQty ? `${pharmacy.availableQuantity} in stock` : "Not confirmed"}
              </div>
            </div>
            {hasQty ? (
              <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                In stock
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Unconfirmed
              </span>
            )}
          </div>
        )}

        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow icon={MapPin} label="Address" value={pharmacy.address || "Not provided"} />
          <DetailRow
            icon={Phone}
            label="Phone"
            value={
              pharmacy.phone ? (
                <a href={`tel:${pharmacy.phone}`} className="text-primary hover:underline">
                  {pharmacy.phone}
                </a>
              ) : (
                "Not provided"
              )
            }
          />
          <DetailRow
            icon={Mail}
            label="Email"
            value={
              pharmacy.email ? (
                <a href={`mailto:${pharmacy.email}`} className="text-primary hover:underline">
                  {pharmacy.email}
                </a>
              ) : (
                "Not provided"
              )
            }
          />
          <DetailRow
            icon={ListIcon}
            label="District"
            value={pharmacy.district || pharmacy.area || "Not provided"}
          />
        </dl>

        {pharmacy.phone && (
          <a
            href={`tel:${pharmacy.phone}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call pharmacy
          </a>
        )}
      </div>

      {loc && (
        <PharmacyMap
          className="h-[260px] rounded-none border-x-0 border-b-0"
          userLocation={null}
          pharmacies={[pharmacy]}
          showLegend={false}
        />
      )}
    </div>
  );
}

function segmentClass(active) {
  return `inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
    active
      ? "bg-card text-primary shadow-sm ring-1 ring-primary/10"
      : "text-muted-foreground hover:text-foreground"
  }`;
}

// ─── Landing / hero search ──────────────────────────────────────────────────────
function SearchHero({
  query,
  onQueryChange,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  onSearch,
  loading,
  onUseLocation,
  locationStatus,
  locationMessage,
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-3xl border bg-gradient-to-b from-accent/70 to-accent/15 px-6 py-14 text-center shadow-soft sm:px-14 sm:py-20">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft sm:hidden">
          <Pill className="h-5 w-5" aria-hidden="true" />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
          Find medicines.
        </h1>
        <p className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          <span className="text-primary">Near you</span>
          <span className="text-foreground">, when you need them.</span>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Search for your medicine and find it in nearby pharmacies.
        </p>

        <div className="relative mx-auto mt-8 max-w-xl">
          <div className="flex items-center gap-2 rounded-2xl border bg-card p-1.5 shadow-soft">
            <input
              value={query}
              onChange={(e) => {
                onQueryChange(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) onSearch(query.trim());
              }}
              placeholder="Search for a medicine (e.g., Panadol)"
              aria-label="Medication name"
              className="h-11 flex-1 rounded-xl bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              disabled={!query.trim() || loading}
              onClick={() => onSearch(query.trim())}
              aria-label="Search medicine"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border bg-card text-left shadow-soft">
              {suggestions.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onQueryChange(s.name);
                      onSearch(s.name);
                    }}
                    className="w-full px-4 py-2 text-left text-sm capitalize hover:bg-accent hover:text-accent-foreground"
                  >
                    {s.name.toLowerCase()}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onUseLocation}
          disabled={locationStatus === "loading"}
          aria-pressed={locationStatus === "success"}
          className={`mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            locationStatus === "success"
              ? "border-primary bg-primary/15 text-primary hover:bg-primary/20"
              : "border-border bg-card text-primary hover:bg-accent"
          }`}
        >
          {locationStatus === "success" ? (
            <MapPinCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <MapPin className="h-4 w-4" aria-hidden="true" />
          )}
          {locationStatus === "loading"
            ? "Getting your location…"
            : locationStatus === "success"
              ? "Location enabled"
              : "Use my location"}
          {locationStatus === "success" && (
            <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
          )}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          {locationStatus === "success"
            ? "Using your location · Pharmacies ranked by distance"
            : locationStatus === "error"
              ? locationMessage
              : "We'll show you pharmacies near your current location."}
        </p>
      </div>
    </div>
  );
}

// ─── Results view ───────────────────────────────────────────────────────────────
function SearchResults({
  status,
  message,
  medicine,
  pharmacyResults,
  nearbyStatus,
  nearbyMessage,
  userLocation,
  onUseLocation,
  locationStatus,
  onBack,
}) {
  const [viewMode, setViewMode] = useState("map"); // "list" | "map"
  const [detailPharmacy, setDetailPharmacy] = useState(null);

  function openDetail(pharmacy) {
    setDetailPharmacy(pharmacy);
  }

  function handleBackClick() {
    if (detailPharmacy) {
      setDetailPharmacy(null);
    } else {
      onBack();
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleBackClick}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {detailPharmacy ? "Back to results" : "Back to search"}
      </button>

      {detailPharmacy && <PharmacyDetailPage pharmacy={detailPharmacy} medicine={medicine} />}

      {!detailPharmacy && status === "loading" && (
        <p className="rounded-xl border bg-accent px-4 py-3 text-sm">
          Searching the medicine catalog...
        </p>
      )}

      {!detailPharmacy && status === "not-found" && (
        <p className="rounded-xl border bg-accent px-4 py-3 text-sm">{message}</p>
      )}

      {!detailPharmacy && status === "error" && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-500">
          {message}
        </p>
      )}

      {!detailPharmacy && status === "success" && medicine && (
        <>
          <div>
            <h1 className="text-2xl font-bold">{medicine.brandName}</h1>
            <p className="text-sm text-muted-foreground">
              {[medicine.genericName, medicine.strength, medicine.dosageForm]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="inline-flex rounded-xl border bg-muted p-1">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={segmentClass(viewMode === "list")}
            >
              <ListIcon className="h-3.5 w-3.5" aria-hidden="true" />
              List view
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={segmentClass(viewMode === "map")}
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Map view
            </button>
          </div>

          {!userLocation && (
            <div className="flex flex-col items-start gap-3 rounded-xl border bg-accent px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">Use your location to rank pharmacies by distance.</p>
              <button
                type="button"
                onClick={onUseLocation}
                disabled={locationStatus === "loading"}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {locationStatus === "loading" ? "Locating…" : "Use my location"}
              </button>
            </div>
          )}

          {nearbyStatus === "loading" && (
            <p className="rounded-xl border bg-accent px-4 py-3 text-sm">
              Checking nearby pharmacies...
            </p>
          )}
          {nearbyStatus === "error" && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-500">
              {nearbyMessage}
            </p>
          )}
          {nearbyStatus === "empty" && (
            <p className="rounded-xl border bg-accent px-4 py-3 text-sm">
              No registered pharmacies found nearby yet.
            </p>
          )}

          {userLocation && pharmacyResults.length > 0 && viewMode === "map" && (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <PharmacyMap
                className="h-[320px] sm:h-[440px]"
                userLocation={userLocation}
                pharmacies={pharmacyResults}
                onSelect={(id) => {
                  const found = pharmacyResults.find((p) => p.id === id);
                  if (found) openDetail(found);
                }}
              />
              <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <span className="text-sm font-semibold">Nearby pharmacies</span>
                  <span className="text-xs text-muted-foreground">
                    {pharmacyResults.length} nearby
                  </span>
                </div>
                <div className="max-h-[380px] divide-y overflow-y-auto">
                  {pharmacyResults.map((p, idx) => (
                    <PharmacyListItem
                      key={p.id}
                      pharmacy={p}
                      rank={idx + 1}
                      onClick={() => openDetail(p)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {userLocation && pharmacyResults.length > 0 && viewMode === "list" && (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="text-sm font-semibold">Nearby pharmacies</span>
                <span className="text-xs text-muted-foreground">
                  {pharmacyResults.length} nearby
                </span>
              </div>
              <div className="divide-y">
                {pharmacyResults.map((p, idx) => (
                  <PharmacyListItem
                    key={p.id}
                    pharmacy={p}
                    rank={idx + 1}
                    onClick={() => openDetail(p)}
                  />
                ))}
              </div>
              <div className="border-t px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  View on map
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Medication suggestions may come from the U.S. National Library of Medicine (RxNorm).
      </p>
    </div>
  );
}

// ─── Patient Search (data + orchestration) ─────────────────────────────────────
const DAWAA_API_BASE_URL = import.meta.env.VITE_DAWAA_API_BASE_URL;

function PatientSearch({ view, onViewChange }) {
  const searchPharmaciesFn = useServerFn(searchPharmacies);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [medicine, setMedicine] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState("idle");
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [nearbyPharmacies, setNearbyPharmacies] = useState([]);
  const [nearbyStatus, setNearbyStatus] = useState("idle");
  const [nearbyMessage, setNearbyMessage] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

  async function runSearch(name) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    onViewChange("results");

    if (!DAWAA_API_BASE_URL) {
      setMedicine(null);
      setAvailability([]);
      setAvailabilityStatus("idle");
      resetNearbyResults();
      setStatus("error");
      setMessage("Medicine lookup is not configured. Set VITE_DAWAA_API_BASE_URL in your .env file.");
      return;
    }

    setShowSuggestions(false);
    setLoading(true);
    setStatus("loading");
    setMessage("");
    setMedicine(null);
    setAvailability([]);
    setAvailabilityStatus("idle");
    resetNearbyResults();

    let medicineLookupComplete = false;
    try {
      const baseUrl = DAWAA_API_BASE_URL.replace(/\/$/, "");
      const response = await fetch(
        `${baseUrl}/medicines/search?name=${encodeURIComponent(trimmedName)}`,
      );

      if (response.status === 404) {
        setStatus("not-found");
        setMessage(`No active medicine found for "${trimmedName}".`);
        return;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Medicine lookup failed (${response.status}): ${text.slice(0, 200)}`);
      }

      const result = await response.json();
      const foundMedicine = result.medicine;
      setMedicine(foundMedicine);
      setStatus("success");
      medicineLookupComplete = true;

      if (!foundMedicine?.medicineId) {
        setAvailabilityStatus("error");
        return;
      }

      setAvailabilityStatus("loading");
      const availabilityResponse = await fetch(
        `${baseUrl}/inventory/availability?medicineId=${encodeURIComponent(foundMedicine.medicineId)}`,
      );

      if (!availabilityResponse.ok) {
        const text = await availabilityResponse.text();
        throw new Error(
          `Inventory availability lookup failed (${availabilityResponse.status}): ${text.slice(0, 200)}`,
        );
      }

      const availabilityResult = await availabilityResponse.json();
      const availableItems = Array.isArray(availabilityResult.availability)
        ? availabilityResult.availability
        : [];
      setAvailability(availableItems);
      setAvailabilityStatus(availableItems.length > 0 ? "success" : "empty");

      if (userLocation) {
        await loadNearbyPharmacies(userLocation);
      }
    } catch (error) {
      if (medicineLookupComplete) {
        setAvailabilityStatus("error");
      } else {
        setStatus("error");
        setMessage(error?.message ?? "Medicine lookup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function requestLocation() {
    if (locationStatus === "success") {
      setUserLocation(null);
      setLocationStatus("idle");
      setLocationMessage("");
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage("Location is not available in this browser.");
      return;
    }

    setLocationStatus("loading");
    setLocationMessage("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(nextLocation);
        setLocationStatus("success");
        setLocationMessage("Location ready.");

        if (status === "success") {
          await loadNearbyPharmacies(nextLocation);
        }
      },
      (error) => {
        setLocationStatus("error");
        setLocationMessage(error?.message || "Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function loadNearbyPharmacies(location) {
    setNearbyStatus("loading");
    setNearbyMessage("");
    setNearbyPharmacies([]);

    try {
      const result = await searchPharmaciesFn({
        data: { lat: location.lat, lng: location.lng, radius: 50000, limit: 10 },
      });
      const pharmacies = Array.isArray(result.pharmacies) ? result.pharmacies : [];
      setNearbyPharmacies(pharmacies);
      setNearbyStatus(pharmacies.length > 0 ? "success" : "empty");
    } catch (error) {
      setNearbyStatus("error");
      setNearbyMessage(error?.message ?? "Nearby pharmacy lookup failed. Please try again.");
    }
  }

  function resetNearbyResults() {
    setNearbyPharmacies([]);
    setNearbyStatus("idle");
    setNearbyMessage("");
  }

  function handleBack() {
    onViewChange("landing");
  }

  // Merge live location-based pharmacy results with medicine availability data
  const pharmacyResults = useMemo(() => {
    const availByPharmacy = new Map();
    for (const item of availability) {
      if (item?.pharmacyId) availByPharmacy.set(item.pharmacyId, item);
    }
    return nearbyPharmacies
      .map((p) => {
        const key = p.pharmacyId || p.id;
        const avail = availByPharmacy.get(key);
        return {
          ...p,
          id: key,
          hasAvailabilityData: !!avail,
          availableQuantity: avail?.quantity,
          availabilityUpdatedAt: avail?.updatedAt,
        };
      })
      .sort((a, b) => closestDistance(a) - closestDistance(b));
  }, [nearbyPharmacies, availability]);

  if (view === "results") {
    return (
      <SearchResults
        status={status}
        message={message}
        medicine={medicine}
        pharmacyResults={pharmacyResults}
        nearbyStatus={nearbyStatus}
        nearbyMessage={nearbyMessage}
        userLocation={userLocation}
        onUseLocation={requestLocation}
        locationStatus={locationStatus}
        onBack={handleBack}
      />
    );
  }

  return (
    <SearchHero
      query={query}
      onQueryChange={setQuery}
      suggestions={suggestions}
      showSuggestions={showSuggestions}
      setShowSuggestions={setShowSuggestions}
      onSearch={runSearch}
      loading={loading}
      onUseLocation={requestLocation}
      locationStatus={locationStatus}
      locationMessage={locationMessage}
    />
  );
}

// ─── Header / navigation ────────────────────────────────────────────────────────
function NavLink({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative pb-1 text-sm font-medium transition ${active ? "text-primary" : "text-foreground/70 hover:text-foreground"}`}
    >
      {label}
      {active && <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-primary" />}
    </button>
  );
}

function Header({ user, onSignIn, onSignOut, tabs, activeTab, onTabChange }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-4 px-4 py-3.5 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Pill className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold text-primary">Dawaa</span>
        </div>

        <nav className="hidden items-center gap-8 sm:flex">
          {tabs.map((t) => (
            <NavLink
              key={t.id}
              label={t.label}
              active={activeTab === t.id}
              onClick={() => onTabChange(t.id)}
            />
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.name}{" "}
                <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs capitalize">
                  {user.role}
                </span>
              </span>
              <button
                onClick={onSignOut}
                className="h-9 rounded-full border px-4 text-sm font-medium transition hover:bg-accent"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={onSignIn}
              className="h-9 rounded-full border px-4 text-sm font-medium text-primary transition hover:bg-accent"
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      {tabs.length > 1 && (
        <div className="flex gap-1 overflow-x-auto px-4 pb-2.5 sm:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${activeTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

// ─── Home (root page) ───────────────────────────────────────────────────────────
function Home() {
  const { user, login, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [searchView, setSearchView] = useState("landing"); // "landing" | "results"

  const tabs = [
    { id: "search", label: searchView === "results" ? "Find Medicine" : "Home", roles: ["*"] },
    { id: "dashboard", label: "My Inventory", roles: ["pharmacist"] },
    { id: "admin", label: "Admin Panel", roles: ["admin"] },
  ].filter((t) => t.roles.includes("*") || (user && t.roles.includes(user.role)));

  // We show two entries for the patient-facing tab ("Home" and "Find Medicine") so both
  // states of the search flow are directly reachable from the nav bar.
  const navTabs = [
    { id: "home", label: "Home" },
    { id: "find", label: "Find Medicine" },
    ...tabs.filter((t) => t.id !== "search"),
  ];

  function handleTabChange(id) {
    if (id === "home") {
      setActiveTab("search");
      setSearchView("landing");
      return;
    }
    if (id === "find") {
      setActiveTab("search");
      return;
    }
    setActiveTab(id);
  }

  const activeNavId =
    activeTab === "search" ? (searchView === "results" ? "find" : "home") : activeTab;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        user={user}
        onSignIn={() => setShowAuth(true)}
        onSignOut={logout}
        tabs={navTabs}
        activeTab={activeNavId}
        onTabChange={handleTabChange}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {activeTab === "search" && (
          <PatientSearch view={searchView} onViewChange={setSearchView} />
        )}
        {activeTab === "dashboard" && user?.role === "pharmacist" && (
          <PharmacistDashboard user={user} />
        )}
        {activeTab === "admin" && user?.role === "admin" && <AdminPanel />}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onLogin={login} />}
    </div>
  );
}

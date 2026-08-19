import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Navigation, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
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
        data: { requesterUserId: user.id, ...form },
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
    getMyPharmacyFn({ data: { requesterUserId: user.id } })
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
      const result = await getInventoryFn({ data: { requesterUserId: user.id } });
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
          requesterUserId: user.id,
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
      await deleteFn({ data: { requesterUserId: user.id, id } });
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
function AdminPanel({ user }) {
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
        getUsersFn({ data: { requesterUserId: user.id } }),
        getPharmaciesFn({ data: { requesterUserId: user.id } }),
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
      await approveFn({ data: { pharmacyId, requesterUserId: user.id, approved } });
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

// ─── Patient Search View ───────────────────────────────────────────────────────
const DAWAA_API_BASE_URL = import.meta.env.VITE_DAWAA_API_BASE_URL;

function PatientSearch() {
  const searchPharmaciesFn = useServerFn(searchPharmacies);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchedName, setSearchedName] = useState("");
  const [medicine, setMedicine] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [nearbyPharmacies, setNearbyPharmacies] = useState([]);
  const [nearestPharmacy, setNearestPharmacy] = useState(null);
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
    if (!trimmedName) {
      setMedicine(null);
      setAvailability([]);
      setAvailabilityStatus("idle");
      setAvailabilityMessage("");
      resetNearbyResults();
      setStatus("error");
      setMessage("Enter a medicine name to search.");
      return;
    }
    if (!DAWAA_API_BASE_URL) {
      setMedicine(null);
      setAvailability([]);
      setAvailabilityStatus("idle");
      setAvailabilityMessage("");
      resetNearbyResults();
      setStatus("error");
      setMessage(
        "Medicine lookup is not configured. Set VITE_DAWAA_API_BASE_URL in your .env file.",
      );
      return;
    }

    setSearchedName(trimmedName);
    setShowSuggestions(false);
    setLoading(true);
    setStatus("loading");
    setMessage("");
    setMedicine(null);
    setAvailability([]);
    setAvailabilityStatus("idle");
    setAvailabilityMessage("");
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
        setAvailabilityMessage("Medicine found, but it does not have an inventory lookup id.");
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
        setAvailabilityMessage(
          error?.message ?? "Inventory availability lookup failed. Please try again.",
        );
      } else {
        setStatus("error");
        setMessage(error?.message ?? "Medicine lookup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function requestLocation() {
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
    setNearestPharmacy(null);

    try {
      const result = await searchPharmaciesFn({
        data: {
          lat: location.lat,
          lng: location.lng,
          radius: 50000,
          limit: 10,
        },
      });
      const pharmacies = Array.isArray(result.pharmacies) ? result.pharmacies : [];
      setNearbyPharmacies(pharmacies);
      setNearestPharmacy(result.nearestPharmacy ?? pharmacies[0] ?? null);
      setNearbyStatus(pharmacies.length > 0 ? "success" : "empty");
    } catch (error) {
      setNearbyStatus("error");
      setNearbyMessage(error?.message ?? "Nearby pharmacy lookup failed. Please try again.");
    }
  }

  function resetNearbyResults() {
    setNearbyPharmacies([]);
    setNearestPharmacy(null);
    setNearbyStatus(userLocation ? "idle" : "idle");
    setNearbyMessage("");
  }

  const canSearch = useMemo(() => query.trim().length > 0, [query]);

  return (
    <div className="space-y-6">
      {/* Search bar */}
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
              placeholder="Search a medication (e.g. Panadol)"
              className="w-full h-12 rounded-xl border bg-background px-4 pr-10 outline-none focus:ring-2 focus:ring-ring transition"
              aria-label="Medication name"
            />
            <Search
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
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
          <button
            type="button"
            disabled={!canSearch || loading}
            onClick={() => runSearch(query.trim())}
            className="h-12 rounded-xl px-6 bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:opacity-95 transition"
          >
            {loading ? "Searching..." : "Search medicine"}
          </button>
        </div>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <button
            type="button"
            onClick={requestLocation}
            disabled={locationStatus === "loading"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50 transition"
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {locationStatus === "loading" ? "Getting location..." : "Use my location"}
          </button>
          {locationStatus === "success" && (
            <span className="text-sm text-muted-foreground">
              Location ready for nearby pharmacy results.
            </span>
          )}
          {locationStatus === "error" && (
            <span className="text-sm text-red-500">{locationMessage}</span>
          )}
        </div>
        {searchedName && status !== "loading" && (
          <p className="mt-3 text-sm text-muted-foreground">
            Showing medicine lookup for{" "}
            <span className="font-medium text-foreground">{searchedName}</span>.
          </p>
        )}
        {status === "loading" && (
          <p className="mt-3 text-sm bg-accent border border-border rounded-lg px-3 py-2">
            Searching the medicine catalog...
          </p>
        )}
        {status === "not-found" && (
          <p className="mt-3 text-sm bg-accent border border-border rounded-lg px-3 py-2">
            {message}
          </p>
        )}
        {status === "error" && (
          <p className="mt-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {message}
          </p>
        )}
      </section>

      {/* Results */}
      {status === "success" && medicine && (
        <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold">Medicine found</h2>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold text-lg">{medicine.brandName}</div>
                <div className="text-sm text-muted-foreground">{medicine.genericName}</div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700 shrink-0">
                Active
              </span>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Medicine ID</dt>
                <dd className="text-sm font-medium">{medicine.medicineId}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Strength</dt>
                <dd className="text-sm font-medium">{medicine.strength}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Dosage form</dt>
                <dd className="text-sm font-medium">{medicine.dosageForm}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Manufacturer</dt>
                <dd className="text-sm font-medium">{medicine.manufacturer}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Normalized brand</dt>
                <dd className="text-sm font-medium">{medicine.normalizedBrandName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Normalized generic</dt>
                <dd className="text-sm font-medium">{medicine.normalizedGenericName}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {status === "success" && medicine && (
        <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <h2 className="font-semibold">Nearest pharmacy</h2>
            {nearbyStatus === "success" && (
              <span className="text-xs text-muted-foreground">
                {nearbyPharmacies.length} nearby
              </span>
            )}
          </div>
          <div className="px-4 py-4">
            {!userLocation && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-accent px-3 py-3">
                <p className="text-sm flex-1">Use your location to rank registered pharmacies.</p>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-95 transition"
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  Use location
                </button>
              </div>
            )}
            {userLocation && nearbyStatus === "idle" && (
              <button
                type="button"
                onClick={() => loadNearbyPharmacies(userLocation)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-medium hover:bg-accent transition"
              >
                <Navigation className="h-4 w-4" aria-hidden="true" />
                Find nearest pharmacy
              </button>
            )}
            {nearbyStatus === "loading" && (
              <p className="text-sm bg-accent border border-border rounded-lg px-3 py-2">
                Checking nearby pharmacies...
              </p>
            )}
            {nearbyStatus === "empty" && (
              <p className="text-sm bg-accent border border-border rounded-lg px-3 py-2">
                No registered pharmacies found within 50 km.
              </p>
            )}
            {nearbyStatus === "error" && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {nearbyMessage}
              </p>
            )}
            {nearbyStatus === "success" && nearestPharmacy && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-accent px-4 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-muted-foreground">Closest match</div>
                      <div className="font-semibold truncate">{nearestPharmacy.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {nearestPharmacy.address || nearestPharmacy.area || "Address unavailable"}
                      </div>
                    </div>
                    <span className="text-sm font-semibold shrink-0">
                      {formatDistance(closestDistance(nearestPharmacy))}
                    </span>
                  </div>
                </div>
                {nearbyPharmacies.length > 1 && (
                  <ul className="divide-y">
                    {nearbyPharmacies.slice(1, 4).map((pharmacy) => (
                      <li
                        key={pharmacy.pharmacyId || pharmacy.id}
                        className="py-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{pharmacy.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {pharmacy.area || pharmacy.address || "Address unavailable"}
                          </div>
                        </div>
                        <div className="text-sm font-semibold shrink-0">
                          {formatDistance(closestDistance(pharmacy))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {status === "success" && medicine && (
        <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <h2 className="font-semibold">Pharmacy availability</h2>
            {availabilityStatus === "success" && (
              <span className="text-xs text-muted-foreground">
                {availability.length} location{availability.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="px-4 py-4">
            {availabilityStatus === "loading" && (
              <p className="text-sm bg-accent border border-border rounded-lg px-3 py-2">
                Checking pharmacy inventory...
              </p>
            )}
            {availabilityStatus === "empty" && (
              <p className="text-sm bg-accent border border-border rounded-lg px-3 py-2">
                No pharmacies currently report this medicine as in stock.
              </p>
            )}
            {availabilityStatus === "error" && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {availabilityMessage}
              </p>
            )}
            {availabilityStatus === "success" && (
              <ul className="divide-y">
                {availability.map((item) => (
                  <li
                    key={`${item.pharmacyId}-${item.availableLocationKey || item.availableMedicineId}`}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        Pharmacy {item.pharmacyId || "unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        Location key: {item.availableLocationKey || "not provided"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold">{item.quantity ?? 0} available</div>
                      <div className="text-xs text-muted-foreground">
                        {item.updatedAt
                          ? `Updated ${new Date(item.updatedAt).toLocaleDateString()}`
                          : "Updated date unavailable"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Medication suggestions may come from the U.S. National Library of Medicine (RxNorm).
      </p>
    </div>
  );
}

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

function Home() {
  const { user, login, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [activeTab, setActiveTab] = useState("search");

  // Determine what tabs to show based on role
  const tabs = [
    { id: "search", label: "Find Medication", roles: ["*"] },
    { id: "dashboard", label: "My Inventory", roles: ["pharmacist"] },
    { id: "admin", label: "Admin Panel", roles: ["admin"] },
  ].filter((t) => t.roles.includes("*") || (user && t.roles.includes(user.role)));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold text-lg">
              د
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Dawaa</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                دواء · Your medication finder in Lebanon
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.name}{" "}
                  <span className="bg-muted px-1.5 py-0.5 rounded text-xs capitalize ml-1">
                    {user.role}
                  </span>
                </span>
                <button
                  onClick={logout}
                  className="h-9 rounded-xl px-4 border text-sm font-medium hover:bg-accent transition"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="h-9 rounded-xl px-4 bg-primary text-primary-foreground text-sm font-medium hover:opacity-95 transition"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        {tabs.length > 1 && (
          <div className="mx-auto max-w-7xl px-4 flex gap-1 pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">
        {activeTab === "search" && <PatientSearch />}
        {activeTab === "dashboard" && user?.role === "pharmacist" && (
          <PharmacistDashboard user={user} />
        )}
        {activeTab === "admin" && user?.role === "admin" && <AdminPanel user={user} />}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onLogin={login} />}
    </div>
  );
}

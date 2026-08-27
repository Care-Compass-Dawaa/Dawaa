import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  List as ListIcon,
  Mail,
  MapPin,
  MapPinCheck,
  Navigation,
  Pencil,
  Phone,
  Pill,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  loginUser,
  registerUser,
  deactivateCurrentUser,
  updateCurrentUser,
  getInventory,
  upsertInventoryItem,
  deleteInventoryItem,
  getAllUsers,
  activateUserAsAdmin,
  deactivateUserAsAdmin,
  getAllPharmacies,
  approvePharmacy,
  registerPharmacy,
  getMyPharmacy,
  updateMyPharmacy,
  updateMyPharmacySchedule,
  getRouteDirections,
  searchPharmacies,
} from "@/lib/pharmacies.functions";
import { MedicineSelectionPage } from "@/pages/MedicineSelectionPage";

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

  function updateUser(userData) {
    localStorage.setItem("dawaa_user", JSON.stringify(userData));
    setUser(userData);
  }

  return { user, login, logout, updateUser };
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
  const [showPassword, setShowPassword] = useState(false);

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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card rounded-2xl border shadow-soft w-full max-w-md p-6"
        onMouseDown={(e) => e.stopPropagation()}
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
          <div className="relative">
            <input
              required
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-11 w-full rounded-xl border bg-background px-4 pr-11 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
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
  const [form, setForm] = useState({
    name: "",
    address: "",
    area: "",
    district: "",
    phone: "",
    email: "",
    latitude: "",
    longitude: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const requesterUserId = user?.userId ?? user?.id;

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
    if (
      form.latitude === "" ||
      form.longitude === "" ||
      !Number.isFinite(Number(form.latitude)) ||
      !Number.isFinite(Number(form.longitude))
    ) {
      setError("Latitude and longitude are required for nearby pharmacy search.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await registerPharmacyFn({
        data: { requesterUserId, ...form },
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

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }

    setLocationStatus("loading");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((f) => ({
          ...f,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocationStatus("success");
      },
      (err) => {
        setError(err?.message || "Could not get this device location.");
        setLocationStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
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
          <div className="flex min-w-0 items-start gap-6">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Mail className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
            <h2 className="text-lg font-semibold">Register your pharmacy</h2>
            <p className="text-xs text-muted-foreground">
              This lets patients find your pharmacy when searching for medication.
            </p>
            </div>
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
            <label className="text-sm font-medium">District</label>
            <input
              value={form.district}
              onChange={field("district")}
              placeholder="e.g. Beirut"
              className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

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
              placeholder="e.g. +961 76 123 456"
              className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={field("email")}
              placeholder="pharmacy@example.com"
              className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label className="text-sm font-medium">
                  Pharmacy coordinates <span className="text-red-500">*</span>
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  These are required for nearby search and distance ranking.
                </p>
              </div>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locationStatus === "loading"}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border bg-background px-3 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
              >
                <MapPinCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {locationStatus === "loading" ? "Locating..." : "Use current location"}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                inputMode="decimal"
                value={form.latitude}
                onChange={field("latitude")}
                placeholder="Latitude"
                className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
              />
              <input
                required
                inputMode="decimal"
                value={form.longitude}
                onChange={field("longitude")}
                placeholder="Longitude"
                className="h-11 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
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
const WEEK_DAYS = [
  ["MONDAY", "Mon"],
  ["TUESDAY", "Tue"],
  ["WEDNESDAY", "Wed"],
  ["THURSDAY", "Thu"],
  ["FRIDAY", "Fri"],
  ["SATURDAY", "Sat"],
  ["SUNDAY", "Sun"],
];

function emptyWeeklyHours() {
  return Object.fromEntries(WEEK_DAYS.map(([day]) => [day, []]));
}

function normalizeScheduleForm(hours) {
  const weeklyHours = emptyWeeklyHours();
  const incoming = hours?.weeklyHours ?? {};
  for (const [day] of WEEK_DAYS) {
    weeklyHours[day] = Array.isArray(incoming[day])
      ? incoming[day].map((interval) => ({
          open: interval.open || "08:00",
          close: interval.close || "22:00",
        }))
      : [];
  }

  return {
    timezone: hours?.timezone || "Asia/Beirut",
    hoursMode: hours?.hoursMode || "unknown",
    weeklyHours,
  };
}

function pharmacyOpenLabel(pharmacy) {
  const status = pharmacy?.openStatus ?? pharmacy?.open?.openStatus;
  const openNow = pharmacy?.openNow ?? pharmacy?.open?.openNow;
  if (openNow === true || status === "open") return "Open now";
  if (openNow === false || status === "closed") return "Closed";
  return "Hours unknown";
}

function pharmacyOpenBadgeClass(pharmacy) {
  const status = pharmacy?.openStatus ?? pharmacy?.open?.openStatus;
  const openNow = pharmacy?.openNow ?? pharmacy?.open?.openNow;
  if (openNow === true || status === "open") return "bg-green-100 text-green-700";
  if (openNow === false || status === "closed") return "bg-red-50 text-red-600";
  return "bg-muted text-muted-foreground";
}

function formatTodayIntervals(pharmacy) {
  const intervals = pharmacy?.open?.todayIntervals ?? [];
  if (!Array.isArray(intervals) || intervals.length === 0) return "";
  return intervals.map((interval) => `${interval.open}-${interval.close}`).join(", ");
}

function PharmacyScheduleEditor({ form, saving, onChange, onSave }) {
  function setField(key, value) {
    onChange((current) => ({ ...current, [key]: value }));
  }

  function setInterval(day, index, key, value) {
    onChange((current) => {
      const intervals = [...(current.weeklyHours[day] ?? [])];
      intervals[index] = { ...intervals[index], [key]: value };
      return {
        ...current,
        weeklyHours: { ...current.weeklyHours, [day]: intervals },
      };
    });
  }

  function addInterval(day) {
    onChange((current) => ({
      ...current,
      weeklyHours: {
        ...current.weeklyHours,
        [day]: [...(current.weeklyHours[day] ?? []), { open: "08:00", close: "22:00" }],
      },
    }));
  }

  function removeInterval(day, index) {
    onChange((current) => ({
      ...current,
      weeklyHours: {
        ...current.weeklyHours,
        [day]: (current.weeklyHours[day] ?? []).filter((_, i) => i !== index),
      },
    }));
  }

  return (
    <form onSubmit={onSave} className="mt-4 grid gap-4 border-t pt-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <select
          value={form.hoursMode}
          onChange={(e) => setField("hoursMode", e.target.value)}
          className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="unknown">Hours unknown</option>
          <option value="regular">Regular weekly hours</option>
          <option value="twentyFourHours">Open 24 hours</option>
        </select>
        <input
          value={form.timezone}
          onChange={(e) => setField("timezone", e.target.value)}
          className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {form.hoursMode === "regular" && (
        <div className="grid gap-3">
          {WEEK_DAYS.map(([day, label]) => (
            <div key={day} className="grid gap-2 rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{label}</span>
                <button
                  type="button"
                  onClick={() => addInterval(day)}
                  disabled={(form.weeklyHours[day] ?? []).length >= 4}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add interval
                </button>
              </div>
              {(form.weeklyHours[day] ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Closed</p>
              ) : (
                <div className="grid gap-2">
                  {form.weeklyHours[day].map((interval, index) => (
                    <div key={`${day}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        type="time"
                        value={interval.open}
                        onChange={(e) => setInterval(day, index, "open", e.target.value)}
                        className="h-9 rounded-lg border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="time"
                        value={interval.close}
                        onChange={(e) => setInterval(day, index, "close", e.target.value)}
                        className="h-9 rounded-lg border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => removeInterval(day, index)}
                        className="grid h-9 w-9 place-items-center rounded-lg border bg-background text-muted-foreground transition hover:bg-accent hover:text-red-600"
                        aria-label={`Remove ${label} interval`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save schedule"}
        </button>
      </div>
    </form>
  );
}

function PharmacistDashboard({ user }) {
  const [pharmacy, setPharmacy] = useState(null);
  const [checkingPharmacy, setCheckingPharmacy] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    medicineId: "",
    medicineName: "",
    quantity: "",
    inStock: true,
    editId: null,
  });
  const [medicineMatches, setMedicineMatches] = useState([]);
  const [medicineSearchStatus, setMedicineSearchStatus] = useState("idle");
  const [saving, setSaving] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [pharmacySaving, setPharmacySaving] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [pharmacyForm, setPharmacyForm] = useState({
    email: "",
    phone: "",
    latitude: "",
    longitude: "",
  });
  const [scheduleForm, setScheduleForm] = useState(() => normalizeScheduleForm());
  const [pharmacyLocationStatus, setPharmacyLocationStatus] = useState("idle");

  const getMyPharmacyFn = useServerFn(getMyPharmacy);
  const updateMyPharmacyFn = useServerFn(updateMyPharmacy);
  const updateMyPharmacyScheduleFn = useServerFn(updateMyPharmacySchedule);
  const getInventoryFn = useServerFn(getInventory);
  const upsertFn = useServerFn(upsertInventoryItem);
  const deleteFn = useServerFn(deleteInventoryItem);
  const requesterUserId = user?.userId ?? user?.id;

  // On mount, check if this pharmacist has a registered pharmacy
  useEffect(() => {
    getMyPharmacyFn({ data: { requesterUserId } })
      .then((res) => setPharmacy(res.pharmacy))
      .catch(() => setPharmacy(null))
      .finally(() => setCheckingPharmacy(false));
  }, [requesterUserId]);

  // Load inventory once pharmacy is confirmed
  useEffect(() => {
    if (pharmacy) loadInventory();
  }, [pharmacy]);

  useEffect(() => {
    if (!pharmacy) return;
    setPharmacyForm({
      email: pharmacy.email || "",
      phone: pharmacy.phone || "",
      latitude: String(pharmacy.latitude ?? pharmacy.location?.lat ?? ""),
      longitude: String(pharmacy.longitude ?? pharmacy.location?.lng ?? ""),
    });
    setScheduleForm(normalizeScheduleForm(pharmacy.hours));
  }, [pharmacy]);

  useEffect(() => {
    const q = form.medicineName.trim();
    if (!DAWAA_API_BASE_URL || form.medicineId || q.length < 2) {
      setMedicineMatches([]);
      setMedicineSearchStatus("idle");
      return;
    }

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setMedicineSearchStatus("loading");
      try {
        const baseUrl = DAWAA_API_BASE_URL.replace(/\/$/, "");
        const res = await fetch(
          `${baseUrl}/medicines/suggestions?q=${encodeURIComponent(q)}&limit=8`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error("Medicine search failed");
        const json = await res.json();
        const matches = Array.isArray(json.suggestions) ? json.suggestions : [];
        setMedicineMatches(matches);
        setMedicineSearchStatus(matches.length > 0 ? "success" : "empty");
      } catch (err) {
        if (err?.name !== "AbortError") {
          setMedicineMatches([]);
          setMedicineSearchStatus("error");
        }
      }
    }, 250);

    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [form.medicineName, form.medicineId]);

  async function loadInventory() {
    setLoading(true);
    setError(null);
    try {
      const result = await getInventoryFn({ data: { requesterUserId } });
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
    if (!form.medicineId) {
      setError("Choose a medicine from the catalog before saving inventory.");
      return;
    }
    const duplicate = inventory.find(
      (item) => item.medicineId === form.medicineId && item.id !== form.editId,
    );
    if (duplicate) {
      setError("Medicine is already in your inventory. Edit it from current inventory.");
      setInventoryQuery(duplicate.medicineName || form.medicineName);
      return;
    }
    const quantity = Math.max(0, Number(form.quantity) || 0);
    const inStock = quantity > 0;
    setSaving(true);
    try {
      await upsertFn({
        data: {
          requesterUserId,
          id: form.editId,
          medicineId: form.medicineId,
          medicineName: form.medicineName.trim(),
          quantity,
          inStock,
        },
      });
      setForm({ medicineId: "", medicineName: "", quantity: "", inStock: true, editId: null });
      setMedicineMatches([]);
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
      await deleteFn({ data: { requesterUserId, id } });
      await loadInventory();
    } catch (err) {
      setError(err?.message ?? "Failed to delete");
    }
  }

  async function handleUpdatePharmacy(e) {
    e.preventDefault();
    setPharmacySaving(true);
    setError(null);
    try {
      const result = await updateMyPharmacyFn({
        data: {
          requesterUserId,
          email: pharmacyForm.email,
          phone: pharmacyForm.phone,
          latitude: pharmacyForm.latitude,
          longitude: pharmacyForm.longitude,
        },
      });
      setPharmacy(result.pharmacy);
      setEditingPharmacy(false);
    } catch (err) {
      setError(err?.message ?? "Failed to update pharmacy");
    } finally {
      setPharmacySaving(false);
    }
  }

  async function handleUpdateSchedule(e) {
    e.preventDefault();
    setScheduleSaving(true);
    setError(null);
    try {
      const result = await updateMyPharmacyScheduleFn({
        data: {
          requesterUserId,
          timezone: scheduleForm.timezone,
          hoursMode: scheduleForm.hoursMode,
          weeklyHours: scheduleForm.weeklyHours,
        },
      });
      setPharmacy(result.pharmacy);
      setEditingSchedule(false);
    } catch (err) {
      setError(err?.message ?? "Failed to update pharmacy schedule");
    } finally {
      setScheduleSaving(false);
    }
  }

  function usePharmacyCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }

    setPharmacyLocationStatus("loading");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPharmacyForm((f) => ({
          ...f,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setPharmacyLocationStatus("success");
      },
      (err) => {
        setError(err?.message || "Could not get this device location.");
        setPharmacyLocationStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function startEdit(item) {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    setForm({
      medicineId: item.medicineId || item.id,
      medicineName: item.medicineName,
      quantity,
      inStock: quantity > 0,
      editId: item.id,
    });
    setMedicineMatches([]);
  }

  function selectInventoryMedicine(medicine) {
    const duplicate = inventory.find(
      (item) => item.medicineId === medicine.medicineId && item.id !== form.editId,
    );
    if (duplicate) {
      setError("Medicine is already in your inventory. Edit it from current inventory.");
      setInventoryQuery(duplicate.medicineName || medicine.brandName);
      setMedicineMatches([]);
      setMedicineSearchStatus("idle");
      return;
    }

    setForm((f) => ({
      ...f,
      medicineId: medicine.medicineId,
      medicineName: medicine.brandName,
    }));
    setError(null);
    setMedicineMatches([]);
    setMedicineSearchStatus("idle");
  }

  function inventoryMedicineLabel(medicine) {
    return [medicine.genericName, medicine.strength, medicine.dosageForm].filter(Boolean).join(" - ");
  }

  const normalizedInventoryQuery = inventoryQuery.trim().toLowerCase();
  const filteredInventory = normalizedInventoryQuery
    ? inventory.filter((item) =>
        [item.medicineName, item.medicineId]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedInventoryQuery)),
      )
    : inventory;

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
    <div className="mx-auto max-w-6xl px-2">
      {/* Pharmacy profile card */}
      <div className="flex items-start justify-between gap-4 py-7">
        <div className="flex min-w-0 items-start gap-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            🏥
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="truncate text-2xl font-bold">{pharmacy.name}</span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${pharmacy.approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
              >
                {pharmacy.approved ? "Approved" : "Pending approval"}
              </span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {pharmacy.area} · {pharmacy.address} · {pharmacy.phone}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-0 border-t py-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-6">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Mail className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
            <h2 className="text-lg font-semibold">Pharmacy details</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {pharmacy.email || "No email"} · {pharmacy.latitude ?? pharmacy.location?.lat},{" "}
              {pharmacy.longitude ?? pharmacy.location?.lng}
            </p>
              </div>
            </div>
          <button
            type="button"
            onClick={() => setEditingPharmacy((value) => !value)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-3 text-sm font-semibold text-primary transition hover:opacity-75"
          >
            <Pencil className="h-5 w-5" aria-hidden="true" />
            {editingPharmacy ? "Close" : "Edit"}
          </button>
        </div>

        {editingPharmacy && (
          <form onSubmit={handleUpdatePharmacy} className="mt-4 grid gap-3 border-t pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="email"
                value={pharmacyForm.email}
                onChange={(e) => setPharmacyForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Pharmacy email"
                className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                required
                type="tel"
                value={pharmacyForm.phone}
                onChange={(e) => setPharmacyForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+961 76 123 456"
                className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input
                required
                inputMode="decimal"
                value={pharmacyForm.latitude}
                onChange={(e) => setPharmacyForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="Latitude"
                className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                required
                inputMode="decimal"
                value={pharmacyForm.longitude}
                onChange={(e) => setPharmacyForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="Longitude"
                className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={usePharmacyCurrentLocation}
                disabled={pharmacyLocationStatus === "loading"}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
              >
                <MapPinCheck className="h-4 w-4" aria-hidden="true" />
                {pharmacyLocationStatus === "loading" ? "Locating..." : "Use location"}
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPharmacy(false)}
                className="h-10 rounded-xl border px-4 text-sm font-medium transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pharmacySaving}
                className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
              >
                {pharmacySaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mb-10 border-t py-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-6">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Clock className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Opening hours</h2>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${pharmacyOpenBadgeClass(pharmacy)}`}
              >
                {pharmacyOpenLabel(pharmacy)}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {pharmacy.hours?.hoursMode === "twentyFourHours"
                ? "Open 24 hours"
                : formatTodayIntervals(pharmacy) || "No hours available for today"}
            </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingSchedule((value) => !value)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-3 text-sm font-semibold text-primary transition hover:opacity-75"
          >
            <Pencil className="h-5 w-5" aria-hidden="true" />
            {editingSchedule ? "Close" : "Edit"}
          </button>
        </div>

        {editingSchedule && (
          <PharmacyScheduleEditor
            form={scheduleForm}
            saving={scheduleSaving}
            onChange={setScheduleForm}
            onSave={handleUpdateSchedule}
          />
        )}
      </div>

      <h2 className="mb-8 text-3xl font-bold">Pharmacy Inventory</h2>

      <div className="mb-10">
        <h3 className="mb-5 text-xl font-semibold">
          {form.editId ? "Edit medicine" : "Add medicine"}
        </h3>
        <form onSubmit={handleSave} className="grid max-w-4xl gap-5 sm:grid-cols-[minmax(0,1fr)_120px_auto_auto]">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              required
              value={form.medicineName}
              onChange={(e) =>
                setForm((f) => ({ ...f, medicineId: "", medicineName: e.target.value }))
              }
              placeholder="Search medicine catalog"
              className="h-14 w-full rounded-xl border bg-background pl-14 pr-4 text-base outline-none focus:ring-2 focus:ring-ring"
            />
            {form.medicineId && (
              <p className="mt-1 text-xs text-green-700">Catalog medicine selected</p>
            )}
            {!form.medicineId && medicineSearchStatus === "empty" && (
              <p className="mt-1 text-xs text-muted-foreground">No catalog matches yet.</p>
            )}
            {!form.medicineId && medicineMatches.length > 0 && (
              <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-xl border bg-card shadow-soft">
                {medicineMatches.map((medicine) => (
                  <button
                    key={medicine.medicineId}
                    type="button"
                    onClick={() => selectInventoryMedicine(medicine)}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="block font-medium">{medicine.brandName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {inventoryMedicineLabel(medicine) || "Medicine catalog match"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="number"
            min="0"
            value={form.quantity}
            onChange={(e) => {
              const nextQuantity = Math.max(0, Number(e.target.value) || 0);
              setForm((f) => ({
                ...f,
                quantity: e.target.value,
                inStock: nextQuantity > 0,
              }));
            }}
            placeholder="Qty"
            className="h-14 rounded-xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <span
            className={`inline-flex h-14 items-center justify-center rounded-xl px-5 text-base font-semibold ${
              Math.max(0, Number(form.quantity) || 0) > 0
                ? "bg-green-100 text-green-700"
                : "bg-primary/10 text-muted-foreground"
            }`}
          >
            {Math.max(0, Number(form.quantity) || 0) > 0 ? "In stock" : "Out of stock"}
          </span>
          <button
            type="submit"
            disabled={saving}
            className="h-14 rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : form.editId ? "Update" : "Add"}
          </button>
          {form.editId && (
            <button
              type="button"
              onClick={() =>
                setForm({
                  medicineId: "",
                  medicineName: "",
                  quantity: "",
                  inStock: true,
                  editId: null,
                })
              }
              className="h-14 rounded-xl border px-4 text-sm transition hover:bg-accent sm:col-start-4"
            >
              Cancel
            </button>
          )}
        </form>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div>
        <div className="mb-8">
          <span className="text-xl font-semibold">Current inventory</span>
          {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={inventoryQuery}
              onChange={(e) => setInventoryQuery(e.target.value)}
              placeholder="Search current inventory"
              className="h-14 w-full rounded-xl border bg-background pl-14 pr-4 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        {inventory.length === 0 && !loading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            No medicines added yet.
          </p>
        ) : filteredInventory.length === 0 && !loading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            No medicines match your search.
          </p>
        ) : (
          <ul className="divide-y">
            {filteredInventory.map((item) => (
              <li key={item.id} className="flex items-center gap-6 px-2 py-5">
                {(() => {
                  const itemInStock = Math.max(0, Number(item.quantity) || 0) > 0;
                  return (
                    <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xl font-bold">{item.medicineName}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Qty: {item.quantity} · Updated: {new Date(item.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${itemInStock ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}
                >
                  {itemInStock ? "In stock" : "Out of stock"}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="text-sm font-medium text-red-500 hover:underline"
                >
                  Remove
                </button>
                    </>
                  );
                })()}
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
  const requesterUserId = user?.userId ?? user?.id;

  const getUsersFn = useServerFn(getAllUsers);
  const activateUserFn = useServerFn(activateUserAsAdmin);
  const deactivateUserFn = useServerFn(deactivateUserAsAdmin);
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
        getUsersFn({ data: { requesterUserId } }),
        getPharmaciesFn({ data: { requesterUserId } }),
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
      await approveFn({ data: { pharmacyId, requesterUserId, approved } });
      await loadData();
    } catch (err) {
      setError(err?.message ?? "Failed to update pharmacy");
    }
  }

  async function handleDeactivateUser(targetUser) {
    const targetUserId = targetUser?.userId ?? targetUser?.id;
    if (!targetUserId) return;

    const confirmed = window.confirm(`Deactivate ${targetUser.name || targetUser.email}?`);
    if (!confirmed) return;

    try {
      await deactivateUserFn({ data: { requesterUserId, targetUserId } });
      await loadData();
    } catch (err) {
      setError(err?.message ?? "Failed to deactivate user");
    }
  }

  async function handleActivateUser(targetUser) {
    const targetUserId = targetUser?.userId ?? targetUser?.id;
    if (!targetUserId) return;

    try {
      await activateUserFn({ data: { requesterUserId, targetUserId } });
      await loadData();
    } catch (err) {
      setError(err?.message ?? "Failed to activate user");
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
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      u.active === false
                        ? "bg-red-50 text-red-600"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {u.active === false ? "Inactive" : "Active"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Joined {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                  {u.role !== "admin" && u.active !== false && (
                    <button
                      type="button"
                      onClick={() => handleDeactivateUser(u)}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      Deactivate
                    </button>
                  )}
                  {u.role !== "admin" && u.active === false && (
                    <button
                      type="button"
                      onClick={() => handleActivateUser(u)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Activate
                    </button>
                  )}
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

function formatDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds)) {
    return "Time unavailable";
  }
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
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
  routeCoordinates = [],
  className = "",
  showLegend = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);
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
    if (routeRef.current) {
      map.removeLayer(routeRef.current);
      routeRef.current = null;
    }

    const bounds = [];
    const routeLatLngs = routeCoordinates
      .filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2)
      .map(([lng, lat]) => [lat, lng])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (routeLatLngs.length > 1) {
      routeRef.current = L.polyline(routeLatLngs, {
        color: "#7c3aed",
        weight: 5,
        opacity: 0.85,
      }).addTo(map);
      bounds.push(...routeLatLngs);
    }

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
  }, [ready, userLocation, pharmacies, selectedId, onSelect, routeCoordinates]);

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
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pharmacyOpenBadgeClass(pharmacy)}`}>
            {pharmacyOpenLabel(pharmacy)}
          </span>
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

function PharmacyDetailPage({ pharmacy, medicine, userLocation }) {
  const getRouteDirectionsFn = useServerFn(getRouteDirections);
  const loc = pharmacyLatLng(pharmacy);
  const hasQty = pharmacy.hasAvailabilityData && Number.isFinite(pharmacy.availableQuantity);
  const [navigating, setNavigating] = useState(false);
  const [liveLocation, setLiveLocation] = useState(userLocation);
  const [route, setRoute] = useState(null);
  const [routeStatus, setRouteStatus] = useState("idle");
  const [routeMessage, setRouteMessage] = useState("");

  useEffect(() => {
    setLiveLocation(userLocation);
  }, [userLocation]);

  useEffect(() => {
    if (!navigating) return undefined;

    if (!navigator.geolocation) {
      setRouteStatus("error");
      setRouteMessage("Live directions need browser location access.");
      setNavigating(false);
      return undefined;
    }

    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setRouteStatus("error");
        setRouteMessage("Could not update your live location.");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [navigating]);

  useEffect(() => {
    if (!navigating || !liveLocation || !loc) return undefined;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setRouteStatus("loading");
      setRouteMessage("");

      getRouteDirectionsFn({
        data: {
          from: liveLocation,
          to: loc,
        },
      })
        .then((directions) => {
          if (cancelled) return;
          setRoute(directions);
          setRouteStatus("success");
        })
        .catch((err) => {
          if (cancelled) return;
          setRoute(null);
          setRouteStatus("error");
          setRouteMessage(err?.message ?? "Could not load route directions.");
        });
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    navigating,
    liveLocation?.lat,
    liveLocation?.lng,
    loc?.lat,
    loc?.lng,
    getRouteDirectionsFn,
  ]);

  function toggleDirections() {
    if (navigating) {
      setNavigating(false);
      setRoute(null);
      setRouteStatus("idle");
      setRouteMessage("");
      return;
    }

    if (!userLocation) {
      setRouteStatus("error");
      setRouteMessage("Use your location before starting directions.");
      return;
    }

    setLiveLocation(userLocation);
    setNavigating(true);
  }

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
          <DetailRow
            icon={Clock}
            label="Hours"
            value={
              pharmacy.hours?.hoursMode === "twentyFourHours"
                ? "Open 24 hours"
                : `${pharmacyOpenLabel(pharmacy)}${formatTodayIntervals(pharmacy) ? `: ${formatTodayIntervals(pharmacy)}` : ""}`
            }
          />
        </dl>

        <div className="flex flex-wrap gap-3">
          {pharmacy.phone && (
            <a
              href={`tel:${pharmacy.phone}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call pharmacy
            </a>
          )}
          {loc && (
            <button
              type="button"
              onClick={toggleDirections}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium transition hover:bg-accent"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              {navigating ? "Stop directions" : "Start directions"}
            </button>
          )}
        </div>

        {(route || routeStatus === "loading" || routeStatus === "error") && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              routeStatus === "error" ? "border-red-200 bg-red-50 text-red-600" : "bg-accent"
            }`}
          >
            {routeStatus === "loading" && "Loading route directions..."}
            {routeStatus === "error" && routeMessage}
            {routeStatus === "success" && route && (
              <span>
                {formatDuration(route.durationSeconds)} drive - {formatDistance(route.distanceMeters)} remaining
              </span>
            )}
          </div>
        )}
      </div>

      {loc && (
        <PharmacyMap
          className="h-[260px] rounded-none border-x-0 border-b-0"
          userLocation={navigating ? liveLocation : userLocation}
          pharmacies={[pharmacy]}
          routeCoordinates={route?.coordinates ?? []}
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
  openNowOnly,
  onOpenNowOnlyChange,
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

      {detailPharmacy && (
        <PharmacyDetailPage
          pharmacy={detailPharmacy}
          medicine={medicine}
          userLocation={userLocation}
        />
      )}

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

          <div className="flex flex-wrap items-center justify-between gap-3">
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
            <label className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={openNowOnly}
                onChange={(e) => onOpenNowOnlyChange(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Open now only
            </label>
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
              No nearby pharmacies currently report this medicine in stock.
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
  const [medicineOptions, setMedicineOptions] = useState([]);
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
  const [openNowOnly, setOpenNowOnly] = useState(false);
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

    onViewChange("choose-medicine");

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
    setMedicineOptions([]);
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
      const foundMedicines = Array.isArray(result.medicines)
        ? result.medicines
        : result.medicine
          ? [result.medicine]
          : [];
      setMedicineOptions(foundMedicines);
      if (foundMedicines.length === 0) {
        setMessage(`No active medicine found for "${trimmedName}".`);
      }
      setStatus("choose");
      medicineLookupComplete = true;
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

  async function selectMedicine(foundMedicine) {
    if (!foundMedicine?.medicineId) {
      setAvailabilityStatus("error");
      setMessage("Selected medicine is missing a catalog ID.");
      return;
    }

    setMedicine(foundMedicine);
    setStatus("success");
    setMessage("");
    setAvailability([]);
    resetNearbyResults();
    onViewChange("results");

    if (!DAWAA_API_BASE_URL) return;

    setLoading(true);
    setAvailabilityStatus("loading");
    try {
      const baseUrl = DAWAA_API_BASE_URL.replace(/\/$/, "");
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
        await loadNearbyPharmacies(userLocation, foundMedicine.medicineId, openNowOnly);
      }
    } catch (error) {
      setAvailabilityStatus("error");
      setNearbyStatus("error");
      setNearbyMessage(error?.message ?? "Medicine availability lookup failed.");
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
          await loadNearbyPharmacies(nextLocation, medicine?.medicineId, openNowOnly);
        }
      },
      (error) => {
        setLocationStatus("error");
        setLocationMessage(error?.message || "Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function loadNearbyPharmacies(
    location,
    medicineId = medicine?.medicineId,
    nextOpenNowOnly = openNowOnly,
  ) {
    setNearbyStatus("loading");
    setNearbyMessage("");
    setNearbyPharmacies([]);

    try {
      const result = await searchPharmaciesFn({
        data: {
          lat: location.lat,
          lng: location.lng,
          radius: 50000,
          limit: 10,
          medicineId,
          openNowOnly: nextOpenNowOnly,
        },
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

  function updateOpenNowOnly(value) {
    setOpenNowOnly(value);
    if (userLocation && status === "success") {
      loadNearbyPharmacies(userLocation, medicine?.medicineId, value);
    }
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
    const shouldRequireAvailability =
      !!medicine?.medicineId && ["success", "empty"].includes(availabilityStatus);

    return nearbyPharmacies
      .map((p) => {
        const key = p.pharmacyId || p.id;
        const avail = availByPharmacy.get(key);
        return {
          ...p,
          id: key,
          hasAvailabilityData: !!avail || p.hasAvailabilityData,
          availableQuantity: avail?.quantity ?? p.availableQuantity,
          availabilityUpdatedAt: avail?.updatedAt ?? p.availabilityUpdatedAt,
        };
      })
      .filter((pharmacy) => !shouldRequireAvailability || pharmacy.hasAvailabilityData)
      .sort((a, b) => closestDistance(a) - closestDistance(b));
  }, [nearbyPharmacies, availability, availabilityStatus, medicine?.medicineId]);

  if (view === "choose-medicine") {
    return (
      <MedicineSelectionPage
        query={query}
        medicines={medicineOptions}
        loading={loading && status === "loading"}
        message={message}
        onBack={handleBack}
        onSelect={selectMedicine}
      />
    );
  }

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
        openNowOnly={openNowOnly}
        onOpenNowOnlyChange={updateOpenNowOnly}
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

function Header({ user, onSignIn, onSignOut, onOpenAccount, tabs, activeTab, onTabChange }) {
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
              <div className="relative">
                <button
                  type="button"
                  onClick={onOpenAccount}
                  className="hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground sm:inline-flex"
                >
                  <span>{user.name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs capitalize">
                    {user.role}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <button
                onClick={onSignOut}
                className="h-9 rounded-full border px-4 text-sm font-medium transition hover:bg-accent sm:hidden"
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
  const { user, login, logout, updateUser } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: "", email: "", password: "" });
  const [activeTab, setActiveTab] = useState("search");
  const [searchView, setSearchView] = useState("landing"); // "landing" | "results"
  const [accountError, setAccountError] = useState(null);
  const deactivateUserFn = useServerFn(deactivateCurrentUser);
  const updateCurrentUserFn = useServerFn(updateCurrentUser);
  const currentUserKey = user?.userId ?? user?.id ?? user?.email ?? "guest";

  useEffect(() => {
    setActiveTab("search");
    setSearchView("landing");
    setShowAuth(false);
    setShowAccount(false);
    setShowDeactivateConfirm(false);
    setEditingAccount(false);
    setAccountError(null);
  }, [currentUserKey]);

  useEffect(() => {
    if (!user) return;
    setAccountForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
    });
  }, [user]);

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

  async function handleDeactivateAccount() {
    if (!user) return;

    setAccountError(null);
    try {
      await deactivateUserFn({ data: { requesterUserId: user.userId ?? user.id } });
      logout();
      setActiveTab("search");
      setSearchView("landing");
    } catch (err) {
      setAccountError(err?.message ?? "Could not deactivate account.");
    }
  }

  async function handleUpdateAccount(e) {
    e.preventDefault();
    if (!user) return;

    setAccountSaving(true);
    setAccountError(null);
    try {
      const result = await updateCurrentUserFn({
        data: {
          requesterUserId: user.userId ?? user.id,
          name: accountForm.name,
          email: accountForm.email,
          password: accountForm.password,
        },
      });
      updateUser(result.user);
      setEditingAccount(false);
      setAccountForm((form) => ({ ...form, password: "" }));
    } catch (err) {
      setAccountError(err?.message ?? "Could not update account.");
    } finally {
      setAccountSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        user={user}
        onSignIn={() => setShowAuth(true)}
        onSignOut={logout}
        onOpenAccount={() => setShowAccount(true)}
        tabs={navTabs}
        activeTab={activeNavId}
        onTabChange={handleTabChange}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {accountError && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {accountError}
          </p>
        )}
        {activeTab === "search" && (
          <PatientSearch
            key={`search-${currentUserKey}`}
            view={searchView}
            onViewChange={setSearchView}
          />
        )}
        {activeTab === "dashboard" && user?.role === "pharmacist" && (
          <PharmacistDashboard key={`dashboard-${currentUserKey}`} user={user} />
        )}
        {activeTab === "admin" && user?.role === "admin" && (
          <AdminPanel key={`admin-${currentUserKey}`} user={user} />
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onLogin={login} />}
      {showAccount && user && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowAccount(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-card p-4 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b pb-3">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
            {accountError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {accountError}
              </p>
            )}
            {editingAccount && (
              <form onSubmit={handleUpdateAccount} className="mt-3 flex flex-col gap-3">
                <input
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  required
                  type="email"
                  value={accountForm.email}
                  onChange={(e) => setAccountForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Email"
                  className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="password"
                  value={accountForm.password}
                  onChange={(e) => setAccountForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="New password"
                  className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccount(false);
                      setAccountForm({
                        name: user.name || "",
                        email: user.email || "",
                        password: "",
                      });
                    }}
                    className="h-9 rounded-xl border px-3 text-sm font-medium transition hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={accountSaving}
                    className="h-9 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
                  >
                    {accountSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {!editingAccount && (
                <button
                  type="button"
                  onClick={() => setEditingAccount(true)}
                  className="h-10 rounded-xl border px-3 text-left text-sm font-medium transition hover:bg-accent"
                >
                  Edit account
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowAccount(false);
                  logout();
                }}
                className="h-10 rounded-xl border px-3 text-left text-sm font-medium transition hover:bg-accent"
              >
                Sign out
              </button>
              {user.role !== "admin" && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAccount(false);
                    setShowDeactivateConfirm(true);
                  }}
                  className="h-10 rounded-xl border border-red-200 px-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Deactivate account
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {showDeactivateConfirm && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowDeactivateConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Deactivate account</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to deactivate your account?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeactivateConfirm(false)}
                className="h-10 rounded-xl border px-4 text-sm font-medium transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeactivateConfirm(false);
                  handleDeactivateAccount();
                }}
                className="h-10 rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

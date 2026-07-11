import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { getSession, logout } from "@/lib/auth";

export const Route = createFileRoute("/pharmacist")({
  beforeLoad: ({ location }) => {
    const session = getSession();
    if (!session) throw { redirect: { to: "/login", search: { redirect: location.href } } };
    if (session.role !== "pharmacist" && session.role !== "admin") {
      throw { redirect: { to: "/unauthorized" } };
    }
    return { session };
  },
  component: PharmacistDashboard,
});

// ---------------------------------------------------------------------------
// Mock pharmacy profile (would come from auth/backend in production)
// ---------------------------------------------------------------------------
const PHARMACY_PROFILE = {
  name: "Al-Amin Pharmacy",
  address: "Hamra Street, Beirut",
  phone: "+961 1 234 567",
  openHours: "Mon–Sat 8:00–20:00",
};

// ---------------------------------------------------------------------------
// Persist inventory in localStorage so refreshes keep the data
// ---------------------------------------------------------------------------
const STORAGE_KEY = "dawaa_pharmacist_inventory";

function loadInventory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [
    { id: crypto.randomUUID(), name: "Paracetamol 500mg", quantity: 120, unit: "tablets", inStock: true, lastUpdated: new Date().toISOString() },
    { id: crypto.randomUUID(), name: "Ibuprofen 400mg", quantity: 60, unit: "tablets", inStock: true, lastUpdated: new Date().toISOString() },
    { id: crypto.randomUUID(), name: "Amoxicillin 250mg", quantity: 0, unit: "capsules", inStock: false, lastUpdated: new Date().toISOString() },
  ];
}

function saveInventory(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------
const EMPTY_FORM = { name: "", quantity: "", unit: "tablets", inStock: true };

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function PharmacistDashboard() {
  const navigate = useNavigate();
  const session = getSession();
  const [inventory, setInventory] = useState(() => loadInventory());
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all"); // "all" | "in" | "out"
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState(null); // { msg, type }
  const [confirmDelete, setConfirmDelete] = useState(null); // item id to confirm
  const nameRef = useRef(null);

  // Persist on every change
  useEffect(() => saveInventory(inventory), [inventory]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Focus name field when form opens
  useEffect(() => {
    if (editingId !== null || form !== EMPTY_FORM) nameRef.current?.focus();
  }, [editingId]);

  // ---- helpers ----
  function showToast(msg, type = "success") {
    setToast({ msg, type });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) return;
    const qty = parseInt(form.quantity, 10);
    const quantity = isNaN(qty) || qty < 0 ? 0 : qty;

    if (editingId) {
      setInventory((inv) =>
        inv.map((item) =>
          item.id === editingId
            ? { ...item, name: trimmedName, quantity, unit: form.unit, inStock: form.inStock, lastUpdated: new Date().toISOString() }
            : item,
        ),
      );
      showToast(`"${trimmedName}" updated successfully.`);
    } else {
      const newItem = {
        id: crypto.randomUUID(),
        name: trimmedName,
        quantity,
        unit: form.unit,
        inStock: form.inStock,
        lastUpdated: new Date().toISOString(),
      };
      setInventory((inv) => [newItem, ...inv]);
      showToast(`"${trimmedName}" added to inventory.`);
    }
    resetForm();
  }

  function startEdit(item) {
    setForm({ name: item.name, quantity: String(item.quantity), unit: item.unit, inStock: item.inStock });
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function requestDelete(id) {
    setConfirmDelete(id);
  }

  function confirmDeleteItem() {
    const item = inventory.find((i) => i.id === confirmDelete);
    setInventory((inv) => inv.filter((i) => i.id !== confirmDelete));
    showToast(`"${item?.name}" removed from inventory.`, "warning");
    setConfirmDelete(null);
    if (editingId === confirmDelete) resetForm();
  }

  function toggleStock(id) {
    setInventory((inv) =>
      inv.map((item) =>
        item.id === id
          ? { ...item, inStock: !item.inStock, lastUpdated: new Date().toISOString() }
          : item,
      ),
    );
  }

  // ---- derived data ----
  const filtered = inventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "in" && item.inStock) ||
      (filterStatus === "out" && !item.inStock);
    return matchesSearch && matchesStatus;
  });

  const totalIn = inventory.filter((i) => i.inStock).length;
  const totalOut = inventory.filter((i) => !i.inStock).length;

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  // ---- render ----
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ── */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold shrink-0">
            +
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold leading-tight truncate">Pharmacist Dashboard</h1>
            <p className="text-xs text-muted-foreground truncate">{session?.name} · {PHARMACY_PROFILE.name}</p>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition shrink-0">Home</Link>
          <button
            onClick={() => { logout(); navigate({ to: "/login", replace: true }); }}
            className="text-sm text-red-500 hover:underline shrink-0"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-soft text-sm font-medium transition-all
            ${toast.type === "warning" ? "bg-[color:var(--warning)] text-foreground" : "bg-primary text-primary-foreground"}`}
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 bg-foreground/20 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="bg-card rounded-2xl border shadow-soft p-6 max-w-sm w-full">
            <h2 className="font-semibold text-base mb-2">Remove medicine?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              "{inventory.find((i) => i.id === confirmDelete)?.name}" will be removed from your inventory. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteItem}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 space-y-6">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-2xl p-4 shadow-soft text-center">
            <div className="text-2xl font-bold text-foreground">{inventory.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Total medicines</div>
          </div>
          <div className="bg-card border rounded-2xl p-4 shadow-soft text-center">
            <div className="text-2xl font-bold text-[color:var(--success)]">{totalIn}</div>
            <div className="text-xs text-muted-foreground mt-1">In stock</div>
          </div>
          <div className="bg-card border rounded-2xl p-4 shadow-soft text-center">
            <div className="text-2xl font-bold text-red-500">{totalOut}</div>
            <div className="text-xs text-muted-foreground mt-1">Out of stock</div>
          </div>
        </div>

        {/* ── Add / Edit Form ── */}
        <section className="bg-card border rounded-2xl shadow-soft p-5">
          <h2 className="font-semibold text-sm mb-4">
            {editingId ? "✏️ Edit medicine" : "➕ Add medicine to inventory"}
          </h2>
          <form onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Medicine name */}
              <div className="sm:col-span-2">
                <label htmlFor="med-name" className="text-xs font-medium text-muted-foreground block mb-1">
                  Medicine name <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  ref={nameRef}
                  id="med-name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g. Paracetamol 500mg"
                  className="w-full h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                />
              </div>
              {/* Quantity */}
              <div>
                <label htmlFor="med-qty" className="text-xs font-medium text-muted-foreground block mb-1">
                  Quantity
                </label>
                <input
                  id="med-qty"
                  name="quantity"
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={handleFormChange}
                  placeholder="0"
                  className="w-full h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                />
              </div>
              {/* Unit */}
              <div>
                <label htmlFor="med-unit" className="text-xs font-medium text-muted-foreground block mb-1">
                  Unit
                </label>
                <select
                  id="med-unit"
                  name="unit"
                  value={form.unit}
                  onChange={handleFormChange}
                  className="w-full h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                >
                  <option value="tablets">Tablets</option>
                  <option value="capsules">Capsules</option>
                  <option value="bottles">Bottles</option>
                  <option value="vials">Vials</option>
                  <option value="boxes">Boxes</option>
                  <option value="sachets">Sachets</option>
                  <option value="units">Units</option>
                </select>
              </div>
              {/* In stock toggle */}
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="med-instock"
                  name="inStock"
                  type="checkbox"
                  checked={form.inStock}
                  onChange={handleFormChange}
                  className="h-4 w-4 rounded border accent-primary"
                />
                <label htmlFor="med-instock" className="text-sm cursor-pointer select-none">
                  Currently in stock
                </label>
              </div>
            </div>
            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={!form.name.trim()}
                className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
              >
                {editingId ? "Save changes" : "Add medicine"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-10 px-5 rounded-xl border text-sm font-medium hover:bg-accent transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* ── Inventory Table ── */}
        <section className="bg-card border rounded-2xl shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="font-semibold text-sm shrink-0">Inventory ({filtered.length})</h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Search */}
              <input
                type="search"
                placeholder="Filter by name…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full sm:w-52 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                aria-label="Filter inventory by medicine name"
              />
              {/* Status filter */}
              <div className="flex rounded-xl overflow-hidden border text-sm">
                {[["all", "All"], ["in", "In stock"], ["out", "Out of stock"]].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFilterStatus(val)}
                    className={`px-3 py-1.5 transition ${filterStatus === val ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              {inventory.length === 0
                ? "No medicines in your inventory yet. Add one above."
                : "No medicines match your filter."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Medicine</th>
                    <th className="px-3 py-3 font-medium text-right">Qty</th>
                    <th className="px-3 py-3 font-medium">Unit</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium hidden sm:table-cell">Last updated</th>
                    <th className="px-3 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-accent/30 transition ${editingId === item.id ? "bg-accent/50" : ""}`}
                    >
                      <td className="px-5 py-3 font-medium">{item.name}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-3 text-muted-foreground capitalize">{item.unit}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleStock(item.id)}
                          title="Click to toggle stock status"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition
                            ${item.inStock
                              ? "bg-[color:var(--success)]/15 text-[color:var(--success)] hover:bg-[color:var(--success)]/30"
                              : "bg-red-100 text-red-600 hover:bg-red-200"}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${item.inStock ? "bg-[color:var(--success)]" : "bg-red-500"}`} />
                          {item.inStock ? "In stock" : "Out of stock"}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {formatDate(item.lastUpdated)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            aria-label={`Edit ${item.name}`}
                            className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-accent transition"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground text-center pb-4">
          Inventory is stored locally. Connect the Dawaa Java backend to persist changes across devices.
        </p>
      </main>
    </div>
  );
}

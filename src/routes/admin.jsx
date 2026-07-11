import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getSession, logout, MOCK_USERS } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    const session = getSession();
    if (!session) throw { redirect: { to: "/login", search: { redirect: location.href } } };
    if (session.role !== "admin") throw { redirect: { to: "/unauthorized" } };
    return { session };
  },
  component: AdminPanel,
});

// Local copy of users we can "manage" in the UI (mirrors MOCK_USERS)
const INITIAL_USERS = MOCK_USERS.map((u) => ({ ...u }));

const ROLE_COLORS = {
  patient:    "bg-blue-100 text-blue-700",
  pharmacist: "bg-purple-100 text-purple-700",
  admin:      "bg-amber-100 text-amber-700",
};

function AdminPanel() {
  const navigate   = useNavigate();
  const session    = getSession();
  const [users, setUsers]         = useState(INITIAL_USERS);
  const [toast, setToast]         = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleRoleChange(id, newRole) {
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    showToast("Role updated.");
  }

  function handleRemoveUser() {
    const user = users.find((u) => u.id === confirmId);
    setUsers((us) => us.filter((u) => u.id !== confirmId));
    showToast(`Removed "${user?.name}".`, "warning");
    setConfirmId(null);
  }

  function handleLogout() {
    logout();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold shrink-0">+</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold leading-tight">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Signed in as {session?.name}</p>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition shrink-0">Home</Link>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:underline shrink-0">Sign out</button>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-soft text-sm font-medium
          ${toast.type === "warning" ? "bg-[color:var(--warning)] text-foreground" : "bg-primary text-primary-foreground"}`}
          role="status" aria-live="polite">
          {toast.msg}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmId && (
        <div className="fixed inset-0 z-40 bg-foreground/20 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="bg-card rounded-2xl border shadow-soft p-6 max-w-sm w-full">
            <h2 className="font-semibold mb-2">Remove user?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              "{users.find((u) => u.id === confirmId)?.name}" will be removed. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-accent transition">Cancel</button>
              <button onClick={handleRemoveUser} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition">Remove</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Total users",    users.length,                                  "text-foreground"],
            ["Pharmacists",    users.filter((u) => u.role === "pharmacist").length, "text-purple-600"],
            ["Admins",         users.filter((u) => u.role === "admin").length,      "text-amber-600"],
          ].map(([label, val, color]) => (
            <div key={label} className="bg-card border rounded-2xl p-4 shadow-soft text-center">
              <div className={`text-2xl font-bold ${color}`}>{val}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* User table */}
        <section className="bg-card border rounded-2xl shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-sm">User management ({users.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/30 transition">
                    <td className="px-5 py-3 font-medium">{u.name}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{u.email}</td>
                    <td className="px-3 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        aria-label={`Change role for ${u.name}`}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 outline-none cursor-pointer ${ROLE_COLORS[u.role]}`}
                      >
                        <option value="patient">patient</option>
                        <option value="pharmacist">pharmacist</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => setConfirmId(u.id)}
                        disabled={u.id === session?.id}
                        aria-label={`Remove ${u.name}`}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center pb-4">
          User data is mocked locally. Connect the Dawaa Java backend to manage real accounts.
        </p>
      </main>
    </div>
  );
}

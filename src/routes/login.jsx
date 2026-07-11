import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { login, getSession } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  // If already logged in, skip the login page
  beforeLoad: () => {
    const session = getSession();
    if (session) throw { redirect: { to: roleHome(session.role) } };
  },
  component: LoginPage,
  validateSearch: (search) => ({ redirect: search.redirect ?? "" }),
});

function roleHome(role) {
  if (role === "pharmacist") return "/pharmacist";
  if (role === "admin") return "/admin";
  return "/";
}

// Demo hint per role so testers know what to type
const DEMO_HINTS = [
  { role: "patient",    email: "patient@dawaa.lb",    password: "patient123" },
  { role: "pharmacist", email: "pharmacist@dawaa.lb", password: "pharma123" },
  { role: "admin",      email: "admin@dawaa.lb",      password: "admin123" },
];

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  function fillDemo(hint) {
    setEmail(hint.email);
    setPassword(hint.password);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = login(email, password);
      const dest = redirect && redirect !== "/login" ? redirect : roleHome(session.role);
      navigate({ to: dest, replace: true });
    } catch (err) {
      setError(err.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">

      {/* Logo / branding */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground grid place-items-center text-xl font-bold shadow-soft">
          +
        </div>
        <div>
          <p className="text-xl font-bold leading-tight">Dawaa</p>
          <p className="text-xs text-muted-foreground">Find your medication in Lebanon</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-card border rounded-2xl shadow-soft p-7">
        <h1 className="text-lg font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Access your account to continue.
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-muted-foreground mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="you@example.com"
              className="w-full h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-muted-foreground mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                className="w-full h-10 rounded-xl border bg-background px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring transition"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs hover:text-foreground"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary transition">
            Continue as guest (patient view)
          </Link>
        </div>
      </div>

      {/* Demo credentials */}
      <div className="mt-6 w-full max-w-sm">
        <p className="text-xs text-muted-foreground text-center mb-3">Demo accounts</p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_HINTS.map((h) => (
            <button
              key={h.role}
              type="button"
              onClick={() => fillDemo(h)}
              className="bg-card border rounded-xl px-3 py-2.5 text-center hover:bg-accent transition"
            >
              <div className="text-xs font-medium capitalize">{h.role}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{h.email}</div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Click a role card to auto-fill, then Sign in.
        </p>
      </div>
    </div>
  );
}

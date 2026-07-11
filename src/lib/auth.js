/**
 * auth.js — lightweight client-side auth context for Dawaa.
 *
 * No real backend yet — credentials are matched against a hardcoded list and
 * the session is persisted in localStorage.  Swap `MOCK_USERS` and the
 * `login` function for real API calls when the Java backend is ready.
 */

// ---------------------------------------------------------------------------
// Mock user database  (replace with API call in production)
// ---------------------------------------------------------------------------
export const MOCK_USERS = [
  { id: "u1", name: "Sara Khalil",   email: "patient@dawaa.lb",    password: "patient123",    role: "patient" },
  { id: "u2", name: "Dr. Rami Nasr", email: "pharmacist@dawaa.lb", password: "pharma123",     role: "pharmacist" },
  { id: "u3", name: "Admin",         email: "admin@dawaa.lb",      password: "admin123",      role: "admin" },
];

// ---------------------------------------------------------------------------
// Role definitions — what each role is allowed to access
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS = {
  patient:     { canSearchMeds: true,  canManageInventory: false, canAccessAdmin: false },
  pharmacist:  { canSearchMeds: true,  canManageInventory: true,  canAccessAdmin: false },
  admin:       { canSearchMeds: true,  canManageInventory: true,  canAccessAdmin: true  },
};

// ---------------------------------------------------------------------------
// Session storage helpers
// ---------------------------------------------------------------------------
const SESSION_KEY = "dawaa_session";

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(user) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch { /* ignore */ }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

/**
 * Attempts to log in with the given credentials.
 * Returns { user } on success, or throws an Error with a message.
 */
export function login(email, password) {
  const found = MOCK_USERS.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
  );
  if (!found) throw new Error("Invalid email or password.");
  const session = { id: found.id, name: found.name, email: found.email, role: found.role };
  setSession(session);
  return session;
}

export function logout() {
  clearSession();
}

// ---------------------------------------------------------------------------
// Route guard helper — call inside a route's beforeLoad
// ---------------------------------------------------------------------------

/**
 * requireAuth({ role }) — pass to a route's beforeLoad context.
 * Redirects to /login if not authenticated, or /unauthorized if wrong role.
 */
export function requireAuth(allowedRoles = []) {
  return ({ location }) => {
    const session = getSession();
    if (!session) {
      throw { redirect: { to: "/login", search: { redirect: location.href } } };
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      throw { redirect: { to: "/unauthorized" } };
    }
    return { session };
  };
}

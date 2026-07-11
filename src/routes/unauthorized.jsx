import { createFileRoute, Link } from "@tanstack/react-router";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/unauthorized")({
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  const session = getSession();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-foreground">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account{session ? ` (${session.role})` : ""} does not have permission to view this page.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
          >
            Go home
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-xl border px-5 py-2 text-sm font-medium hover:bg-accent transition"
          >
            Sign in with another account
          </Link>
        </div>
      </div>
    </div>
  );
}

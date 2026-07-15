import Link from "next/link";
import "@/app/(marketing)/landing.css";

// Shared centered frame for the Clerk sign-in / sign-up pages. Uses the
// landing page's .lp tokens (imported above) so the auth screens read as
// part of the marketing funnel, not the app. When auth isn't configured
// (no publishable key — see src/middleware.ts) it explains instead of
// letting the Clerk components throw.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  const authConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="lp" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="wrap" style={{ paddingTop: 28, width: "100%" }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: "1.05rem", textDecoration: "none" }}>
          AgencyMan<span style={{ color: "var(--brand)" }}>.ai</span>
        </Link>
      </div>
      <main
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: "40px 24px 72px",
        }}
      >
        {authConfigured ? (
          children
        ) : (
          <div
            style={{
              maxWidth: 420,
              textAlign: "center",
              color: "var(--ink-soft)",
              lineHeight: 1.6,
            }}
          >
            <h1 style={{ color: "var(--ink)", fontSize: "1.3rem", marginBottom: 8 }}>
              Accounts aren&apos;t enabled yet
            </h1>
            <p>
              You can use everything without one — head to{" "}
              <Link href="/setup" style={{ color: "var(--brand)", fontWeight: 700 }}>
                setup
              </Link>{" "}
              to create your agency profile.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

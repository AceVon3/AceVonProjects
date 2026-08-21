import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { ClerkProvider } from "@clerk/nextjs";
import SignOutCleanup from "@/components/SignOutCleanup";
import "./globals.css";

const authConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const metadata: Metadata = {
  title: "AgencyMan.ai",
  description: "Rate-filing intelligence for insurance agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const page = (
    // suppressHydrationWarning: the landing page's theme-init script sets
    // data-lp-theme + a class on <html> before React hydrates (standard
    // next-themes-style pattern); without this React logs a dev mismatch.
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {/* App chrome (sidebar NavBar) lives in (app)/layout.tsx so the
            marketing landing page can render without it. */}
        {authConfigured && <SignOutCleanup />}
        {children}
        {/* Vercel Web Analytics — per-route page views (2026-08-21). Sits in
            the ROOT layout so both route groups (marketing + app) report.
            No-ops on localhost; requires Web Analytics enabled on the
            Vercel project. */}
        <Analytics />
      </body>
    </html>
  );

  // Auth is dormant without a Clerk key (see src/middleware.ts): the tree
  // renders without ClerkProvider so no page may assume a session exists.
  if (!authConfigured) return page;
  return <ClerkProvider>{page}</ClerkProvider>;
}
// Tabler icon webfont is now @imported in src/app/globals.css and
// served from /_next/static/media/ — no CDN <link> needed here.

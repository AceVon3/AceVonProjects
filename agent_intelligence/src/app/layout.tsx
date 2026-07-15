import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );

  // Auth is dormant without a Clerk key (see src/middleware.ts): the tree
  // renders without ClerkProvider so no page may assume a session exists.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return page;
  return <ClerkProvider>{page}</ClerkProvider>;
}
// Tabler icon webfont is now @imported in src/app/globals.css and
// served from /_next/static/media/ — no CDN <link> needed here.

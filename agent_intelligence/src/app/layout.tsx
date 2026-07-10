import type { Metadata } from "next";
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
  return (
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
}
// Tabler icon webfont is now @imported in src/app/globals.css and
// served from /_next/static/media/ — no CDN <link> needed here.

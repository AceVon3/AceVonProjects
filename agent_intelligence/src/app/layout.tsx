import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Agent Intelligence",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* App chrome (sidebar NavBar) lives in (app)/layout.tsx so the
            marketing landing page can render without it. */}
        {children}
      </body>
    </html>
  );
}
// Tabler icon webfont is now @imported in src/app/globals.css and
// served from /_next/static/media/ — no CDN <link> needed here.

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import NavBar from "@/components/NavBar";

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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Sidebar + content. flex-col on mobile (nav becomes a top bar),
            flex-row on md+ (nav is a left sidebar). min-w-0 on the content
            column lets the inner overflow-x-auto tables scroll instead of
            stretching the flex item. */}
        <div className="flex flex-col md:flex-row min-h-screen">
          <NavBar />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </body>
    </html>
  );
}
// Tabler icon webfont is now @imported in src/app/globals.css and
// served from /_next/static/media/ — no CDN <link> needed here.

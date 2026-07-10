import NavBar from "@/components/NavBar";

// Layout for the application proper (Overview, Prospect, Defend, …).
// The (app) route group exists so the marketing landing page at /landing
// can render without the sidebar; URLs inside the group are unchanged.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Sidebar + content. flex-col on mobile (nav becomes a top bar),
    // flex-row on md+ (nav is a left sidebar). min-w-0 on the content
    // column lets the inner overflow-x-auto tables scroll instead of
    // stretching the flex item.
    <div className="flex flex-col md:flex-row min-h-screen">
      <NavBar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

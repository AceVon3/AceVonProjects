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
    // Icon rail + content. flex-col on mobile (rail becomes a top bar),
    // flex-row on md+ (rail is a slim left column). min-w-0 on the content
    // column lets the inner overflow-x-auto tables scroll instead of
    // stretching the flex item.
    <div className="flex flex-col md:flex-row min-h-screen">
      <NavBar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AgentType, loadProfile } from "@/lib/profile";

type NavItem = { label: string; href: string; icon: string };

// Build the nav list per spec §Navigation:
//   Captive:     Overview · Prospect · Defend · Compliance · Methodology · Profile
//   Independent: Overview · Prospect · Defend · My Carriers · Compliance · Methodology · Profile
//   No profile:  Overview · Methodology  (matches ui-reference Screen 1)
//
// The icons are presentational only (Tabler webfont). The ITEMS and their
// show/hide rules are unchanged from the previous top-bar nav — only the
// visual treatment (left sidebar) differs.
function buildItems(agentType: AgentType | null): NavItem[] {
  if (agentType === null) {
    return [
      { label: "Overview", href: "/", icon: "ti-layout-dashboard" },
      { label: "Methodology", href: "/methodology", icon: "ti-book-2" },
    ];
  }
  const items: NavItem[] = [
    { label: "Overview", href: "/", icon: "ti-layout-dashboard" },
    { label: "Prospect", href: "/prospect", icon: "ti-target-arrow" },
    { label: "Defend", href: "/defend", icon: "ti-shield-half" },
  ];
  if (agentType === "independent") {
    items.push({ label: "My Carriers", href: "/my-carriers", icon: "ti-briefcase" });
  }
  items.push(
    { label: "Compliance", href: "/compliance", icon: "ti-gavel" },
    { label: "Methodology", href: "/methodology", icon: "ti-book-2" },
    { label: "Profile", href: "/setup", icon: "ti-settings" },
  );
  return items;
}

function isActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/") return pathname === "/";
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

export default function NavBar(): React.JSX.Element {
  const pathname = usePathname();
  // Start with null on SSR + first client render so hydration matches; then
  // expand to the full nav once useEffect resolves the profile. This causes
  // a one-frame re-render but no hydration mismatch.
  const [agentType, setAgentType] = useState<AgentType | null>(null);

  useEffect(() => {
    const p = loadProfile();
    setAgentType(p?.agent_type ?? null);
  }, []);

  const items = buildItems(agentType);

  return (
    <aside
      data-testid="navbar"
      data-agent-type={agentType ?? "none"}
      // Dark fill. On md+ it's a fixed-width vertical sidebar that sticks
      // while content scrolls; below md it collapses to a dark horizontal
      // bar whose nav row scrolls sideways (keeps small screens legible).
      className="bg-ink text-white shrink-0 flex flex-col
                 md:w-[224px] md:min-h-screen md:sticky md:top-0 md:self-start"
    >
      {/* Brand */}
      <Link
        href="/"
        className="flex items-center gap-2.5 no-underline text-white shrink-0
                   px-4 h-[56px] md:h-auto md:pt-5 md:pb-4"
      >
        <div className="w-[26px] h-[26px] bg-white rounded-md flex items-center justify-center">
          <i className="ti ti-radar-2 text-ink text-15" />
        </div>
        <span className="font-medium text-14">Agent Intelligence</span>
      </Link>

      {/* Section header — desktop only (reads oddly in the mobile bar) */}
      <div className="hidden md:block px-4 mt-2 mb-1 text-10 uppercase tracking-wider06 text-white/40">
        Platform
      </div>

      {/* Nav items as icon + label rows. Horizontal scroll row on mobile,
          stacked column on md+. shrink-0 on each item keeps the mobile row
          from compressing, so it overflows (scrolls) rather than squishing. */}
      <nav
        className="flex flex-row md:flex-col gap-1 px-2 pb-2 md:pb-4
                   overflow-x-auto md:overflow-x-visible whitespace-nowrap md:whitespace-normal"
      >
        {items.map(item => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid="nav-link"
              data-label={item.label}
              data-active={active ? "true" : "false"}
              className={[
                "shrink-0 flex items-center gap-2.5 no-underline rounded-md",
                "px-3 py-2 text-13 transition-colors",
                active
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/55 font-normal hover:bg-white/5 hover:text-white/80",
              ].join(" ")}
            >
              <i className={`ti ${item.icon} text-15 shrink-0`} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

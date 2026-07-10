"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AgentType, loadProfile } from "@/lib/profile";

type NavItem = { label: string; href: string; icon: string; pinBottom?: boolean };

// Build the nav list per spec §Navigation:
//   Captive:     Overview · Prospect · Defend · My Carrier  · Competitive Positioning · Compliance · Methodology · Profile
//   Independent: Overview · Prospect · Defend · My Carriers · Competitive Positioning · Compliance · Methodology · Profile
//   No profile:  Overview · Methodology  (matches ui-reference Screen 1)
//
// My Carrier(s) shows for BOTH agent types — a captive wants to see their own
// carrier's filings too (they field the calls when rates move). The label is
// singular ("My Carrier") for captives, who sell exactly one carrier. The rail
// is icon-only (Tabler webfont); labels surface as hover tooltips.
function buildItems(agentType: AgentType | null): NavItem[] {
  if (agentType === null) {
    return [
      { label: "Overview", href: "/overview", icon: "ti-layout-dashboard" },
      { label: "Methodology", href: "/methodology", icon: "ti-book-2" },
    ];
  }
  const items: NavItem[] = [
    { label: "Overview", href: "/overview", icon: "ti-layout-dashboard" },
    { label: "Prospect", href: "/prospect", icon: "ti-target-arrow" },
    { label: "Defend", href: "/defend", icon: "ti-shield-half" },
    {
      label: agentType === "captive" ? "My Carrier" : "My Carriers",
      href: "/my-carriers",
      icon: "ti-briefcase",
    },
    // "Competitive Positioning", not "Pricing" — the page's load-bearing band
    // says these are rate changes, NOT price levels (decided 2026-07-06).
    { label: "Competitive Positioning", href: "/positioning", icon: "ti-arrows-left-right" },
    { label: "Compliance", href: "/compliance", icon: "ti-gavel" },
    { label: "Methodology", href: "/methodology", icon: "ti-book-2" },
    // Settings tile pinned to the rail's bottom (mt-auto on md+).
    { label: "Profile", href: "/setup", icon: "ti-settings", pinBottom: true },
  ];
  return items;
}

function isActive(itemHref: string, pathname: string): boolean {
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
      // Navy icon rail ("Command Rail"). On md+ it's a fixed 68px-wide
      // vertical rail that sticks while content scrolls; below md it
      // collapses to a horizontal icon bar whose nav row scrolls sideways.
      className="bg-brand-navy shrink-0 flex flex-row md:flex-col items-center
                 md:w-[68px] md:min-h-screen md:sticky md:top-0 md:self-start
                 px-3 md:px-0 py-0 md:py-[18px]"
    >
      {/* Brand mark — stays inside the app ("/" is the marketing landing) */}
      <Link
        href="/overview"
        aria-label="AgencyMan.ai — Overview"
        className="shrink-0 flex items-center justify-center
                   h-[56px] md:h-auto mr-2 md:mr-0 md:mb-[18px]"
      >
        <Image
          src="/brand/agencyman-mark-white.svg"
          alt="AgencyMan.ai"
          width={28}
          height={28}
        />
      </Link>

      {/* Nav items as 44×44 icon tiles. Horizontal scroll row on mobile,
          stacked column on md+ (settings pinned to the bottom via mt-auto).
          shrink-0 on each tile keeps the mobile row from compressing, so it
          overflows (scrolls) rather than squishing. */}
      <nav
        className="flex flex-row md:flex-col items-center gap-1.5 flex-1 md:w-full
                   md:min-h-0 self-stretch md:self-auto
                   overflow-x-auto md:overflow-x-visible py-1.5 md:py-0"
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
              aria-label={item.label}
              className={[
                "group relative shrink-0 flex items-center justify-center",
                "w-11 h-11 rounded-tile no-underline transition-colors",
                item.pinBottom ? "md:mt-auto" : "",
                "mx-auto md:mx-0",
                active
                  ? "bg-brand-red text-white"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5",
              ].join(" ")}
            >
              <i className={`ti ${item.icon} text-[19px]`} aria-hidden />
              {/* Label tooltip — the rail is icon-only */}
              <span
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1
                           md:left-full md:translate-x-0 md:top-1/2 md:-translate-y-1/2 md:ml-3 md:mt-0
                           whitespace-nowrap rounded-md bg-ink text-white text-11 font-medium
                           px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                role="tooltip"
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

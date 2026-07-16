"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

import { AgentType, loadProfile } from "@/lib/profile";
import { syncProfile } from "@/lib/profileSync";

const authConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

type NavItem = { label: string; href: string; icon: string; pinBottom?: boolean };

// Rail expansion is a pure display preference — persisted so it survives
// reloads, but never part of the agent profile.
const NAV_EXPANDED_KEY = "nav_expanded";

// Build the nav list per spec §Navigation:
//   Captive:     Overview · Prospect · Defend · My Carrier  · Competitive Positioning · Compliance · Methodology · Profile
//   Independent: Overview · Prospect · Defend · My Carriers · Competitive Positioning · Compliance · Methodology · Profile
//   No profile:  Overview · Methodology  (matches ui-reference Screen 1)
//
// My Carrier(s) shows for BOTH agent types — a captive wants to see their own
// carrier's filings too (they field the calls when rates move). The label is
// singular ("My Carrier") for captives, who sell exactly one carrier. The rail
// is icon-only when collapsed (labels surface as hover tooltips); expanding it
// shows the full names inline.
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
    // Brand Health (v2) — composite brand scores from the monthly snapshot.
    { label: "Brand Health", href: "/brand-health", icon: "ti-activity" },
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
  // Expanded by default; collapsing is the opt-in compact mode.
  const [expanded, setExpanded] = useState(true);

  // Re-read the profile on EVERY route change, not just on mount: saving the
  // profile on /setup routes client-side to /overview without remounting this
  // layout, and the rail must pick the new profile up immediately (the stale
  // two-item rail after first save was a real bug).
  useEffect(() => {
    // Wait for the account sync (memoized — settled instantly after the
    // first await) so a fresh device shows the full rail, not the
    // no-profile minimal one, on first paint after sign-in.
    let mounted = true;
    syncProfile().then(() => {
      if (!mounted) return;
      const p = loadProfile();
      setAgentType(p?.agent_type ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [pathname]);

  // Restore the expansion preference after hydration (default: expanded —
  // only an explicit collapse is remembered as "false").
  useEffect(() => {
    try {
      setExpanded(window.localStorage.getItem(NAV_EXPANDED_KEY) !== "false");
    } catch {
      /* storage unavailable — stay expanded */
    }
  }, []);

  function toggleExpanded() {
    setExpanded(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem(NAV_EXPANDED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const items = buildItems(agentType);

  return (
    <aside
      data-testid="navbar"
      data-agent-type={agentType ?? "none"}
      data-expanded={expanded ? "true" : "false"}
      // Navy rail ("Command Rail"). On md+ it's a sticky vertical rail —
      // 68px icon-only when collapsed, 224px icon+label when expanded.
      // Below md it collapses to a horizontal icon bar whose nav row
      // scrolls sideways.
      className={[
        "bg-brand-navy shrink-0 flex flex-row md:flex-col items-center",
        "md:min-h-screen md:sticky md:top-0 md:self-start",
        "px-3 py-0 md:py-[18px] transition-[width] duration-150",
        expanded ? "md:w-[248px] md:px-3 md:items-stretch" : "md:w-[68px] md:px-0",
      ].join(" ")}
    >
      {/* Brand — mark only when collapsed, full lockup when expanded.
          Stays inside the app ("/" is the marketing landing). */}
      <Link
        href="/overview"
        aria-label="AgencyMan.ai — Overview"
        className={[
          "shrink-0 flex items-center h-[56px] md:h-auto mr-2 md:mr-0 md:mb-[18px]",
          expanded ? "md:px-2" : "md:justify-center",
        ].join(" ")}
      >
        <Image
          src="/brand/agencyman-mark-white.svg"
          alt=""
          width={28}
          height={28}
        />
        {/* Wordmark as real text (the lockup SVG's <text> has no font-size,
            so it scales down illegibly). ".ai" wears the on-dark accent red
            per the brand rules. */}
        {expanded && (
          <span className="hidden md:inline text-16 font-semibold text-white ml-2.5 whitespace-nowrap">
            AgencyMan<span className="text-brand-red-soft">.ai</span>
          </span>
        )}
      </Link>

      {/* Nav items. Horizontal scroll row on mobile, stacked column on md+
          (settings pinned to the bottom via mt-auto). shrink-0 on each tile
          keeps the mobile row from compressing, so it overflows (scrolls)
          rather than squishing. */}
      <nav
        className="flex flex-row md:flex-col items-center md:items-stretch gap-1.5 flex-1
                   md:w-full md:min-h-0 self-stretch md:self-auto
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
                "group relative shrink-0 flex items-center rounded-tile no-underline transition-colors",
                expanded
                  ? "w-11 h-11 justify-center md:w-full md:h-auto md:justify-start md:gap-3 md:px-3 md:py-2.5"
                  : "w-11 h-11 justify-center md:mx-auto",
                item.pinBottom ? "md:mt-auto" : "",
                active
                  ? "bg-brand-red text-white"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5",
              ].join(" ")}
            >
              <i className={`ti ${item.icon} text-[19px] shrink-0`} aria-hidden />
              {/* Inline label — expanded rail, md+ only */}
              {expanded && (
                <span
                  className={[
                    "hidden md:block text-14 whitespace-nowrap overflow-hidden text-ellipsis",
                    active ? "text-white font-medium" : "text-white/70 group-hover:text-white/90",
                  ].join(" ")}
                >
                  {item.label}
                </span>
              )}
              {/* Label tooltip — only when the rail is icon-only */}
              {!expanded && (
                <span
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1
                             md:left-full md:translate-x-0 md:top-1/2 md:-translate-y-1/2 md:ml-3 md:mt-0
                             whitespace-nowrap rounded-md bg-ink text-white text-11 font-medium
                             px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                  role="tooltip"
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Expand / collapse toggle — desktop rail only */}
      <button
        type="button"
        onClick={toggleExpanded}
        data-testid="nav-expand-toggle"
        aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
        aria-expanded={expanded}
        className={[
          "hidden md:flex group relative shrink-0 items-center rounded-tile cursor-pointer",
          "border-none bg-transparent text-white/40 hover:text-white/70 hover:bg-white/5",
          "transition-colors mt-1.5",
          expanded ? "w-full gap-3 px-3 py-2.5 justify-start" : "w-11 h-11 justify-center mx-auto",
        ].join(" ")}
      >
        <i
          className={`ti ${expanded ? "ti-chevrons-left" : "ti-chevrons-right"} text-[19px] shrink-0`}
          aria-hidden
        />
        {expanded ? (
          <span className="text-14 whitespace-nowrap">Collapse</span>
        ) : (
          <span
            className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3
                       whitespace-nowrap rounded-md bg-ink text-white text-11 font-medium
                       px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50"
            role="tooltip"
          >
            Expand
          </span>
        )}
      </button>

      {/* Account — avatar menu (profile, sign out) when signed in, a
          sign-in tile while accounts are live but the visitor is signed
          out (soft launch). Hidden entirely while auth is dormant. */}
      {authConfigured && (
        <div
          className={[
            "shrink-0 flex items-center justify-center",
            "ml-2 md:ml-0 md:mt-3",
            expanded ? "md:px-3 md:justify-start" : "md:mx-auto",
          ].join(" ")}
        >
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              aria-label="Sign in"
              className="group relative flex w-11 h-11 items-center justify-center rounded-tile
                         text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors no-underline"
            >
              <i className="ti ti-login text-[19px]" aria-hidden />
              <span
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1
                           md:left-full md:translate-x-0 md:top-1/2 md:-translate-y-1/2 md:ml-3 md:mt-0
                           whitespace-nowrap rounded-md bg-ink text-white text-11 font-medium
                           px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                role="tooltip"
              >
                Sign in
              </span>
            </Link>
          </SignedOut>
        </div>
      )}
    </aside>
  );
}

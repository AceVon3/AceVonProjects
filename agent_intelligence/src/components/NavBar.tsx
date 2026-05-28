"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AgentType, loadProfile } from "@/lib/profile";

type NavItem = { label: string; href: string };

// Build the nav list per spec §Navigation:
//   Captive:     Overview · Prospect · Defend · Compliance · Methodology · Profile
//   Independent: Overview · Prospect · Defend · My Carriers · Compliance · Methodology · Profile
//   No profile:  Overview · Methodology  (matches ui-reference Screen 1)
function buildItems(agentType: AgentType | null): NavItem[] {
  if (agentType === null) {
    return [
      { label: "Overview", href: "/" },
      { label: "Methodology", href: "/methodology" },
    ];
  }
  const items: NavItem[] = [
    { label: "Overview", href: "/" },
    { label: "Prospect", href: "/prospect" },
    { label: "Defend", href: "/defend" },
  ];
  if (agentType === "independent") {
    items.push({ label: "My Carriers", href: "/my-carriers" });
  }
  items.push(
    { label: "Compliance", href: "/compliance" },
    { label: "Methodology", href: "/methodology" },
    { label: "Profile", href: "/setup" },
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
    <div
      data-testid="navbar"
      data-agent-type={agentType ?? "none"}
      className="h-[56px] px-4 bg-surface border-b border-hairline border-line flex items-center justify-between"
    >
      {/* Brand (left) */}
      <Link
        href="/"
        className="flex items-center gap-2.5 no-underline text-ink"
      >
        <div className="w-[22px] h-[22px] bg-ink rounded flex items-center justify-center">
          <i className="ti ti-radar-2 text-surface text-14" />
        </div>
        <span className="font-medium text-14">Agent Intelligence</span>
      </Link>

      {/* Nav links (right) */}
      <nav className="flex gap-[18px] text-13">
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
                "no-underline pb-0.5 border-b-[1.5px]",
                active
                  ? "text-ink font-medium border-ink"
                  : "text-ink-2 font-normal border-transparent",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AgentType } from "@/lib/profile";
import { loadProfile } from "@/lib/profile";

type NavItem = { label: string; href: string };

const C = {
  surface: "#ffffff",
  text: "#1c1c1b",
  text2: "#5F5E5A",
  line: "rgba(0,0,0,0.08)",
};

// Build the nav list per spec §Navigation:
//   Captive:     Overview · Prospect · Defend · Compliance · Methodology · Profile
//   Independent: Overview · Prospect · Defend · My Carriers · Compliance · Methodology · Profile
//   No profile:  Overview · Methodology  (matches ui-reference Screen 1)
//
// Overview is always first. "My Carriers" appears only for independents.
// "Compliance" appears for both agent types.
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

// Active-route match. Exact match for "/", prefix match for other routes so
// /prospect?foo=bar and /prospect/anything would both highlight Prospect.
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
      style={{
        height: 56,
        padding: "0 16px",
        background: C.surface,
        borderBottom: `0.5px solid ${C.line}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Brand (left) */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: C.text,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            background: C.text,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i
            className="ti ti-radar-2"
            style={{ color: C.surface, fontSize: 14 }}
          />
        </div>
        <span style={{ fontWeight: 500, fontSize: 14 }}>
          Agent Intelligence
        </span>
      </Link>

      {/* Nav links (right) */}
      <nav style={{ display: "flex", gap: 18, fontSize: 13 }}>
        {items.map(item => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid="nav-link"
              data-label={item.label}
              data-active={active ? "true" : "false"}
              style={{
                color: active ? C.text : C.text2,
                fontWeight: active ? 500 : 400,
                textDecoration: "none",
                paddingBottom: 2,
                borderBottom: active ? `1.5px solid ${C.text}` : "1.5px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

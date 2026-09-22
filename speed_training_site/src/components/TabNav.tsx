"use client";

import { useEffect, useState } from "react";

export type TabColor = "navy" | "saffron" | "green" | "red" | "blue" | "slate";
export type Tab = {
  id: string;
  label: string;
  color: TabColor;
  /** External destination. When set, the tab is a link out of the binder, never "current". */
  href?: string;
};

// The binder's tab dividers are the site navigation. On desktop they hang
// off the right edge of the page stack; on small screens they become a
// sticky strip across the top. The active tab is the one pulled out.
export default function TabNav({ tabs }: { tabs: Tab[] }) {
  const sectionTabs = tabs.filter((t) => !t.href);
  const [active, setActive] = useState<string>(sectionTabs[0]?.id ?? "");

  useEffect(() => {
    const sections = sectionTabs
      .map((t) => document.getElementById(t.id))
      .filter((s): s is HTMLElement => Boolean(s));
    if (sections.length === 0 || typeof IntersectionObserver === "undefined") return;

    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        let best = "";
        let bestRatio = 0;
        visible.forEach((r, id) => {
          if (r > bestRatio) {
            best = id;
            bestRatio = r;
          }
        });
        if (best) setActive(best);
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  const outTabs = tabs.filter((t) => t.href);
  const sectionLinks = sectionTabs.map((t) => (
    <a
      key={t.id}
      href={`#${t.id}`}
      className={`tab tab--${t.color}`}
      aria-current={active === t.id ? "true" : undefined}
    >
      {t.label}
    </a>
  ));
  const outLinks = outTabs.map((t) => (
    <a key={t.id} href={t.href} className={`tab tab--${t.color} tab--out`}>
      {t.label}
    </a>
  ));

  return (
    <>
      <nav className="tabs" aria-label="Binder tabs">
        <div className="tabs__list">
          {sectionLinks}
          {outLinks}
        </div>
      </nav>
      {/* Mobile: section tabs scroll; the Pricing tab is pinned at the edge so
          the primary action is always in view. */}
      <nav className="tabstrip" aria-label="Binder tabs">
        <div className="tabstrip__scroll">{sectionLinks}</div>
        {outLinks}
      </nav>
    </>
  );
}

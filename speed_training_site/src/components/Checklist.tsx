"use client";

import { useEffect, useRef } from "react";

type Item = { text: React.ReactNode; num?: string };

// A laminated checklist. The ink checks draw in once the list scrolls into
// view; this is the page's one authored motion moment. Reduced motion shows
// the checks already drawn (see globals.css).
export default function Checklist({
  items,
  numbered = false,
  className = "",
}: {
  items: Item[];
  numbered?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-checked");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("is-checked");
            io.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <ul ref={ref} className={`list-none m-0 p-0 ${className}`}>
      {items.map((it, i) => (
        <li key={i} className={numbered ? "check check--num" : "check"} style={{ "--i": i } as React.CSSProperties}>
          {numbered ? (
            <span className="check__box" aria-hidden="true">
              {it.num ?? i + 1}
            </span>
          ) : (
            <svg className="check__box" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="1.5" y="1.5" width="21" height="21" rx="2" />
              <path d="M5.5 12.5l4.5 4.5 9-10" />
            </svg>
          )}
          <span>{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

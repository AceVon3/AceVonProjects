"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { resolveSubtype } from "@/lib/subtypes";

// Sub-type cell: cleaned label + a click-based info bubble. The popover is
// rendered into a portal with fixed positioning so it isn't clipped by the
// table's overflow-x-auto scroll wrapper, and so it works on touch (a `title`
// tooltip wouldn't fire on mobile). Closes on outside-click, Esc, or scroll.
export default function SubtypeCell({ raw }: { raw: string | null }): React.JSX.Element {
  const { label, explanation, catchAll } = resolveSubtype(raw);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (document.getElementById("subtype-pop")?.contains(t)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  function toggle() {
    if (pos) { setPos(null); return; }
    const r = btnRef.current!.getBoundingClientRect();
    const width = 260;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos({ top: r.bottom + 6, left });
  }

  return (
    // Discoverability upgrade (2026-08-12, user request after the SF MI
    // 'Other' mix-up): the WHOLE label is the button (dashed underline +
    // help cursor = the defined-term affordance, and a far bigger tap
    // target than the old 14px dot), the dot itself is larger and
    // blue-filled so it reads interactive, and catch-all rows — where the
    // real confusion lives — carry a visible "what's this?" hint. Explained
    // non-catch-all rows stay compact: label + dot only.
    <span className="inline-flex items-start gap-1 align-top">
      {explanation ? (
        <button
          ref={btnRef}
          type="button"
          data-testid="subtype-info"
          aria-label={`What is ${label}?`}
          aria-expanded={!!pos}
          onClick={toggle}
          className="group inline-flex items-start gap-1 cursor-help border-none bg-transparent p-0 m-0 text-left text-12 text-ink-2"
        >
          <span className="min-w-0 underline decoration-dashed decoration-ink-3/60 underline-offset-2 group-hover:decoration-ink-2">
            {label}
          </span>
          <span
            aria-hidden
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-fill text-blue-text text-10 italic shrink-0 mt-px group-hover:ring-1 group-hover:ring-blue-text/40"
            style={{ fontFamily: "Georgia, serif" }}
          >
            i
          </span>
          {catchAll && (
            <span className="text-11 text-blue-text whitespace-nowrap mt-px group-hover:underline">
              what&rsquo;s this?
            </span>
          )}
        </button>
      ) : (
        <span className="min-w-0">{label}</span>
      )}
      {pos && explanation && createPortal(
        <div
          id="subtype-pop"
          role="tooltip"
          data-testid="subtype-popover"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 260 }}
          className="z-50 rounded-lg border border-hairline border-line-2 bg-surface p-3 text-12 leading-[1.45] text-ink-2 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        >
          <span className="block text-ink font-medium mb-1">
            {label}
            {catchAll && <span className="text-ink-3 font-normal"> · catch-all</span>}
          </span>
          {explanation}
        </div>,
        document.body,
      )}
    </span>
  );
}

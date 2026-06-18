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
    // The `i` follows the label inline (it now lives on the sub-type secondary
    // line inside the carrier cell, not its own column), so it reads as part of
    // the label rather than pinned to a column edge. items-start keeps the dot
    // aligned to the first line when the label wraps.
    <span className="inline-flex items-start gap-1 align-top">
      <span className="min-w-0">{label}</span>
      {explanation && (
        <button
          ref={btnRef}
          type="button"
          data-testid="subtype-info"
          aria-label={`What is ${label}?`}
          aria-expanded={!!pos}
          onClick={toggle}
          className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-soft text-ink-2 text-10 italic cursor-pointer border-none shrink-0 mt-px"
          style={{ fontFamily: "Georgia, serif" }}
        >
          i
        </button>
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

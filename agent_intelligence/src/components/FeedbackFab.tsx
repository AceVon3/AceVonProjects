"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Floating "something looks wrong?" reporter (user-approved mock 2026-08-12).
//
// A quiet pill fixed bottom-right on data pages. Copy adapts per route:
// rate pages ask "Rates look off?", Compliance asks "Does a law look
// wrong?". The panel collects a short message and opens the user's mail
// client via mailto:support@myproagency.com with the page + profile
// context prefilled — v1 is deliberately serverless (the user sees exactly
// what they send); switch to a Resend-backed API route when the digest
// send layer lands. Hidden on /setup and /methodology (nothing to dispute).

const SUPPORT = "support@myproagency.com";

type FabCopy = {
  fab: string;
  title: string;
  sub: string;
  placeholder: string;
  subjectTag: string;
};

const RATES_COPY: FabCopy = {
  fab: "Rates look off? Let us know",
  title: "Rates look off?",
  sub: "Tell us what doesn't match what you know — we trace every report to the source filing.",
  placeholder: "e.g. A carrier's change in my state doesn't match the filing I know…",
  subjectTag: "[Rate data]",
};

const HR_COPY: FabCopy = {
  fab: "Does a law look wrong? Let us know",
  title: "Does a law look wrong?",
  sub: "Tell us which rule looks outdated or incorrect — each summary links its official sources.",
  placeholder: "e.g. The minimum wage shown for my state looks like last year's figure…",
  subjectTag: "[HR/compliance]",
};

function copyForPath(path: string): FabCopy | null {
  if (path.startsWith("/setup") || path.startsWith("/methodology")) return null;
  if (path.startsWith("/compliance")) return HR_COPY;
  return RATES_COPY; // overview, prospect, defend, my-carriers, positioning
}

// Page + profile facts appended to the email body so reports arrive
// debuggable without the user typing any of it. Read from the localStorage
// profile cache — cheap, synchronous, and fine to omit when absent.
function contextLines(path: string): string {
  const lines = [`Page: ${path}`];
  try {
    const raw = window.localStorage.getItem("agent_profile");
    if (raw) {
      const p = JSON.parse(raw);
      if (p.agent_type) lines.push(`Agent type: ${p.agent_type}`);
      if (Array.isArray(p.authorized_brands)) lines.push(`Carriers: ${p.authorized_brands.join(", ")}`);
      if (Array.isArray(p.licensed_states)) lines.push(`Licensed states: ${p.licensed_states.join(", ")}`);
      if (Array.isArray(p.employee_states)) lines.push(`Employee states: ${p.employee_states.join(", ")}`);
    }
  } catch {
    // profile cache unreadable — context is best-effort
  }
  return lines.join("\n");
}

export default function FeedbackFab(): React.JSX.Element | null {
  const pathname = usePathname() ?? "/";
  const copy = copyForPath(pathname);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [phase, setPhase] = useState<"idle" | "sending" | "sent">("idle");
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || fabRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // Close (and keep the draft) when navigating between pages.
  useEffect(() => { setOpen(false); }, [pathname]);

  if (!copy) return null;

  // Server-side send via /api/feedback (Resend). Falls back to the original
  // mailto: when the route is unconfigured (501) or errors — the widget
  // works identically before and after the Resend account exists.
  async function send() {
    const message = msg.trim();
    const context = contextLines(pathname);
    setPhase("sending");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message || "(no message entered)",
          context,
          subjectTag: copy!.subjectTag,
        }),
      });
      if (r.ok) {
        setPhase("sent");
        setMsg("");
        window.setTimeout(() => { setOpen(false); setPhase("idle"); }, 1600);
        return;
      }
    } catch {
      // network error — fall through to mailto
    }
    setPhase("idle");
    const body =
      (message || "(describe what looks wrong)") +
      "\n\n---\nContext (auto-included):\n" + context;
    window.location.href =
      `mailto:${SUPPORT}?subject=${encodeURIComponent(`${copy!.subjectTag} ${copy!.title}`)}` +
      `&body=${encodeURIComponent(body)}`;
    setOpen(false);
  }

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          data-testid="feedback-panel"
          className="fixed bottom-[70px] right-[18px] z-50 w-[305px] max-w-[calc(100vw-24px)] rounded-xl border border-line bg-surface p-4 shadow-[0_6px_24px_rgba(15,20,30,0.14)]"
        >
          <h4 className="m-0 mb-1 text-14 font-[650] text-ink">{copy.title}</h4>
          <p className="m-0 mb-2.5 text-12 leading-[1.5] text-ink-2">{copy.sub}</p>
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder={copy.placeholder}
            rows={4}
            className="w-full box-border rounded-lg border border-line bg-surface px-2.5 py-2 text-12 leading-[1.45] text-ink resize-y focus:outline-none focus:ring-2 focus:ring-blue-fill focus:border-blue-text"
          />
          <button
            type="button"
            onClick={send}
            disabled={phase !== "idle"}
            className={`mt-2.5 w-full rounded-lg border-none py-2.5 text-13 font-bold text-white cursor-pointer ${
              phase === "sent" ? "bg-green-text" : "bg-brand-red hover:opacity-90"
            } ${phase === "sending" ? "opacity-60" : ""}`}
          >
            {phase === "sent" ? "Sent ✓ — thank you" : phase === "sending" ? "Sending…" : "Email support"}
          </button>
          <p className="m-0 mt-2 text-center text-10 text-ink-3">
            Goes to {SUPPORT}
          </p>
        </div>
      )}
      <button
        ref={fabRef}
        type="button"
        data-testid="feedback-fab"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-[18px] right-[18px] z-50 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-12 font-semibold text-ink-2 shadow-[0_6px_24px_rgba(15,20,30,0.14)] cursor-pointer hover:text-ink hover:border-ink-3"
      >
        <span aria-hidden className="inline-flex h-[17px] w-[17px] items-center justify-center rounded-full bg-red-fill text-10 text-brand-red">
          ⚑
        </span>
        {copy.fab}
      </button>
    </>
  );
}

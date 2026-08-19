"use client";

// Launch-offer checkout. Shows the $14.99/mo plan as an order summary with a
// promo/agency-code field. ANY non-empty code "validates" and applies 100%
// off, dropping the total to $0.00 — at which point the payment step is
// removed (a $0.00 total needs no payment method, same behavior as a real
// checkout with a 100% coupon) and the CTA continues into Clerk sign-up.
//
// DELIBERATE CONSTRAINTS (2026-08-19):
//  - No card fields are EVER rendered. This page must never collect payment
//    credentials it won't charge.
//  - Submitting without a code nudges toward the code field instead of dead-
//    ending — there is no paid path behind this page.
//  - The fine print states that promo codes currently apply 100% off. Keep it.

import "../landing.css";

import Link from "next/link";
import { useState } from "react";

// Same inlined mark the landing page uses (theme-following via var(--brand)).
function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="7.5" r="5.5" fill="var(--brand)" />
      <path d="M 24 16 L 8 46 L 15.5 46 L 24 29.5 L 32.5 46 L 40 46 Z" fill="var(--brand)" />
    </svg>
  );
}

const PRICE = "$14.99";

export default function CheckoutPage(): React.JSX.Element {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);

  function applyCode(): void {
    const trimmed = code.trim();
    if (!trimmed) {
      setNudge(true);
      return;
    }
    setApplied(trimmed.toUpperCase());
    setNudge(false);
  }

  return (
    <div className="lp co-page">
      <main className="co-main">
        <div className="co-card" data-testid="checkout-card">
          <div className="co-brand">
            <LogoMark className="co-mark" />
            <span>
              AgencyMan<span className="co-dot">.ai</span>
            </span>
          </div>

          <h1 className="co-title">Start your subscription</h1>

          {/* Order summary */}
          <div className="co-order">
            <div className="co-row">
              <div>
                <div className="co-plan">AgencyMan Pro</div>
                <div className="co-plan-sub">
                  Rate signals, competitive positioning &amp; the 50-state HR hub
                </div>
              </div>
              <div className={`co-price${applied ? " struck" : ""}`}>
                {PRICE}
                <span className="co-per">/mo</span>
              </div>
            </div>

            {applied && (
              <div className="co-row co-discount" data-testid="discount-row">
                <div>
                  Code <b>{applied}</b> — launch offer, 100% off
                </div>
                <div>−{PRICE}</div>
              </div>
            )}

            <div className="co-row co-total">
              <div>Due today</div>
              <div data-testid="due-today">{applied ? "$0.00" : PRICE}</div>
            </div>
          </div>

          {/* Code entry */}
          {!applied ? (
            <div className="co-codeblock">
              <label className="co-label" htmlFor="promo">
                Promo or agency code
              </label>
              <div className="co-coderow">
                <input
                  id="promo"
                  className="co-input"
                  placeholder="e.g. LAUNCH25"
                  value={code}
                  autoComplete="off"
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") applyCode(); }}
                />
                <button className="btn btn-primary" type="button" onClick={applyCode}>
                  Apply
                </button>
              </div>
              {nudge && (
                <p className="co-nudge" role="status">
                  Enter your code to check for launch discounts — codes from any
                  agent community or launch email work here.
                </p>
              )}
              <p className="co-paynote">
                Payment details are collected after your code is checked.
              </p>
            </div>
          ) : (
            <div className="co-applied" role="status" data-testid="applied-note">
              <span className="co-check" aria-hidden="true">✓</span>
              Your code covered the full subscription — no payment method is
              needed for a $0.00 total.
            </div>
          )}

          {/* CTA */}
          {applied ? (
            <Link className="btn btn-primary lg co-cta" href="/sign-up">
              Create your free account →
            </Link>
          ) : (
            <button className="btn btn-primary lg co-cta" type="button" onClick={applyCode}>
              Continue
            </button>
          )}

          <p className="co-fineprint">
            Launch offer: promotional codes currently apply 100% off. No payment
            method is required for a $0.00 total. Cancel anytime.
          </p>
        </div>

        <p className="co-back">
          <Link href="/">← Back to AgencyMan.ai</Link>
        </p>
      </main>
    </div>
  );
}

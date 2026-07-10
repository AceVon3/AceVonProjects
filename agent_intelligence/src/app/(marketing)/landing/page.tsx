"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import {
  BRANDS,
  COVERED_STATES,
  DEFEND_THRESHOLD,
  PROSPECT_THRESHOLD,
} from "@/lib/constants";

import "./landing.css";

// The AgencyMan mark, inlined verbatim from public/brand/agencyman-mark-red.svg
// so it can follow the theme (light red #C42127 / dark red #E8555B via
// var(--brand)) and stay vector-crisp at any size. The committed SVG files in
// public/brand/ remain the canonical assets.
function LogoMark({ className, fill }: { className?: string; fill?: string }) {
  const f = fill ?? "var(--brand)";
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="7.5" r="5.5" fill={f} />
      <path d="M 24 16 L 8 46 L 15.5 46 L 24 29.5 L 32.5 46 L 40 46 Z" fill={f} />
    </svg>
  );
}

function Wordmark() {
  return (
    <span>
      <b>AgencyMan</b>
      <span className="dot">.ai</span>
    </span>
  );
}

// Illustrative sample rows for the hero signal panel. The GEICO NV number is
// a real premium-weighted rollup from the dataset; the others are
// representative. Display only — nothing here feeds the app.
const SAMPLE_SIGNALS = [
  { brand: "GEICO", meta: "Personal Auto · NV", impact: "+50.9%", dir: "up", tag: "prospect" },
  { brand: "Travelers", meta: "Homeowners · AZ", impact: "+12.4%", dir: "up", tag: "prospect" },
  { brand: "Allstate", meta: "Personal Auto · CO", impact: "−4.1%", dir: "down", tag: "defend" },
] as const;

export default function LandingPage(): React.JSX.Element {
  const navRef = useRef<HTMLElement>(null);

  // Nav border on scroll + reveal-on-scroll. The lp-js <html> class (set by
  // the layout script) gates the hidden initial state, so content is never
  // lost without JS.
  useEffect(() => {
    const nav = navRef.current;
    const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll(".lp .reveal").forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-lp-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-lp-theme", next);
    try {
      localStorage.setItem("am-theme", next);
    } catch {
      /* private mode etc. — theme just won't persist */
    }
  };

  return (
    <div className="lp">
      {/* ===================== NAV ===================== */}
      <header className="nav" ref={navRef}>
        <div className="wrap nav-inner">
          <Link className="brand-lockup" href="/landing" aria-label="AgencyMan.ai home">
            <LogoMark className="mark" />
            <Wordmark />
          </Link>
          <nav className="nav-actions" aria-label="Primary">
            <button
              className="theme-btn"
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle light and dark theme"
            >
              <svg className="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              <svg className="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
            </button>
            <Link className="link-quiet" href="/">Open the app</Link>
            <Link className="btn btn-primary" href="/setup">Get started free</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ===================== HERO ===================== */}
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="wrap">
            <div>
              <span className="pill">
                <span className="ping" aria-hidden="true" /> Built for insurance agents
              </span>
              <h1>
                Know every rate move in your market —{" "}
                <span className="accent">before your competitors do.</span>
              </h1>
              <p className="lead">
                AgencyMan.ai turns state rate filings into sales signals: which
                carriers are raising rates in your states, which are cutting
                them, and exactly where your carrier stands. Plus a{" "}
                <Link className="hub-link" href="/compliance">
                  50-state HR &amp; Compliance Hub
                </Link>{" "}
                built for running an agency: at-will and hiring rules, wage
                and overtime thresholds, workers&apos; comp, and state tax
                registration for every state where your team works.
              </p>
              <div className="hero-ctas">
                <Link className="btn btn-primary lg" href="/setup">
                  Set up your agency
                </Link>
                <Link className="btn btn-ghost lg" href="/methodology">
                  See the methodology
                </Link>
              </div>
              <p className="microcopy">
                <b>No account, no credit card.</b> Your profile lives in your browser.
              </p>
            </div>

            {/* Product tease — sample signals, styled in landing tokens only */}
            <div className="signal-panel" aria-hidden="true">
              <LogoMark className="panel-mark" />
              <div className="panel-head">
                <span className="t">The past 3 months&apos; signals</span>
                <span className="s">filtered to your states</span>
              </div>
              {SAMPLE_SIGNALS.map((s) => (
                <div className="sig-row" key={s.brand}>
                  <div className="sig-who">
                    <div className="b">{s.brand}</div>
                    <div className="m">{s.meta}</div>
                  </div>
                  <div className="sig-right">
                    <span className={`sig-impact ${s.dir}`}>{s.impact}</span>
                    <span className={`badge ${s.tag}`}>{s.tag}</span>
                  </div>
                </div>
              ))}
              <div className="panel-foot">
                Premium-weighted, rolled up per filing — sourced from public
                state filing systems.
              </div>
            </div>
          </div>
        </section>

        {/* ===================== PROBLEM ===================== */}
        <section className="band-alt" id="problem">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">The problem</span>
              <h2 className="sec-title">
                The rate story in your market is public. Reading it isn&apos;t.
              </h2>
            </div>
            <div className="prob-cols mt-sections">
              <div className="prob-col reveal">
                <div className="idx">01</div>
                <h3>Rate hikes are invisible until the quote</h3>
                <p>
                  Competitors file rate increases months before customers feel
                  them. Most agents find out when a shopper happens to call —
                  after the window to prospect that book has closed.
                </p>
              </div>
              <div className="prob-col reveal">
                <div className="idx">02</div>
                <h3>Retention risk hides until the cancellation</h3>
                <p>
                  When a competitor cuts rates in your state, your book gets
                  quietly shopped. You see the damage in your lapse report —
                  weeks after you could have called first.
                </p>
              </div>
              <div className="prob-col reveal">
                <div className="idx">03</div>
                <h3>The answers are scattered across 50 sites</h3>
                <p>
                  Filings sit in SERFF portals, comp answers sit in state labor
                  and insurance-department sites. Nobody has time to check them
                  state by state, carrier by carrier.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== FEATURES (bento) ===================== */}
        <section id="features">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">What you get</span>
              <h2 className="sec-title">Six views of your market. One profile.</h2>
              <p className="sec-sub">
                Prospect and Defend are the core signals — the rest of the
                platform exists to make them trustworthy and actionable.
              </p>
            </div>
            <div className="bento mt-sections">
              <div className="card wide reveal">
                <div className="chip c-red">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>
                </div>
                <h3>Prospect</h3>
                <p>
                  Every competitor raising rates {PROSPECT_THRESHOLD}%+ in your
                  licensed states. Those policyholders are about to get a
                  renewal letter they won&apos;t like — be the call they get
                  first, with the filing to back it up.
                </p>
              </div>
              <div className="card wide reveal">
                <div className="chip c-sky">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
                </div>
                <h3>Defend</h3>
                <p>
                  Carriers cutting rates {DEFEND_THRESHOLD}% or more where you
                  work — the filings that put your book at risk. Get ahead of
                  the quiet shopping before the cancellation notice shows up.
                </p>
              </div>
              <div className="card reveal">
                <div className="chip c-violet">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                </div>
                <h3>My Carriers</h3>
                <p>
                  Every recent filing from the brands you sell — never be
                  surprised by your own carrier&apos;s rate action.
                </p>
              </div>
              <div className="card reveal">
                <div className="chip c-emerald">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" /></svg>
                </div>
                <h3>Rate Positioning</h3>
                <p>
                  Your carrier&apos;s premium-weighted rate change vs. each
                  competitor, per line and state, with confidence tiers.
                </p>
              </div>
              <div className="card reveal">
                <div className="chip c-amber">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z" /></svg>
                </div>
                <h3>Compliance</h3>
                <p>
                  The employer questions agency owners actually hit — hiring,
                  wages, workers&apos; comp, taxes — answered per state your
                  employees live and work in, grounded in official sources.
                </p>
              </div>
              <div className="card reveal">
                <div className="chip neutral">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
                </div>
                <h3>Methodology</h3>
                <p>
                  Every number traces to a public filing — rollups, weighting,
                  and per-state sourcing documented in the open.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== HOW IT WORKS (timeline) ===================== */}
        <section className="band-alt" id="how">
          <div className="wrap how-grid">
            <div className="sec-head">
              <span className="eyebrow">How it works</span>
              <h2 className="sec-title">From setup to your first signal in minutes.</h2>
              <p className="sec-sub">
                One short setup, then the platform does the reading for you —
                every filing, every carrier, every state you work.
              </p>
            </div>
            <div className="timeline">
              <div className="tl-item reveal">
                <div className="tl-num">1</div>
                <h3>Set up your profile</h3>
                <p>
                  Captive or independent, the states you&apos;re licensed in, the
                  carriers you sell. Two minutes, stored in your browser — no
                  account to create.
                </p>
              </div>
              <div className="tl-item reveal">
                <div className="tl-num">2</div>
                <h3>We filter every filing</h3>
                <p>
                  Rate filings from state systems and industry data, rolled up
                  per filing and premium-weighted, then cut down to your states
                  and your competitive landscape.
                </p>
              </div>
              <div className="tl-item reveal">
                <div className="tl-num">3</div>
                <h3>Act on the signals</h3>
                <p>
                  Prospect the households facing hikes, call your at-risk book
                  before cheaper competitors do, and walk into every quote
                  knowing exactly where your carrier stands.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== COVERAGE ===================== */}
        <section id="coverage">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Coverage</span>
              <h2 className="sec-title">Built on the public record, at scale.</h2>
            </div>
            <div className="stats-row mt-sections">
              <div className="stat reveal">
                <div className="num">{COVERED_STATES.length}</div>
                <div className="label">states with filing data</div>
              </div>
              <div className="stat reveal">
                <div className="num">{BRANDS.length}</div>
                <div className="label">major carrier brands tracked</div>
              </div>
              <div className="stat reveal">
                <div className="num">2</div>
                <div className="label">lines: Homeowners &amp; Personal Auto</div>
              </div>
              <div className="stat reveal">
                <div className="num">50</div>
                <div className="label">states of compliance resources</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== CLOSING BAND (navy) ===================== */}
        <section className="cta-band" id="get-started">
          <div className="band-glow" aria-hidden="true" />
          <LogoMark className="band-mark" fill="#E8555B" />
          <div className="wrap">
            <h2>Ready to stop guessing which households to call?</h2>
            <p>
              Set up your agency profile in two minutes and walk away with a
              prospect list, a defend list, and your carrier&apos;s exact position
              in every market you work.
            </p>
            <Link className="btn btn-primary lg" href="/setup">
              Open AgencyMan
            </Link>
            <p className="microcopy">
              <b>Nothing to install, nothing to cancel.</b> It runs in your browser.
            </p>
          </div>
        </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <footer>
        <div className="wrap foot-inner">
          <div className="foot-brand">
            {/* Static white mark straight from the committed asset. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/agencyman-mark-white.svg" alt="" width={26} height={26} />
            <span>
              AgencyMan<span className="dot">.ai</span>
            </span>
          </div>
          <nav className="foot-links" aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <Link href="/methodology">Methodology</Link>
            <Link href="/">Open the app</Link>
          </nav>
          <div className="foot-copy">
            © 2026 AgencyMan.ai — rate data compiled from public state filing
            systems and industry sources. Signals are informational, not
            financial or legal advice.
          </div>
        </div>
      </footer>
    </div>
  );
}

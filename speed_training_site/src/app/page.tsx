import Checklist from "@/components/Checklist";
import KartraVideo from "@/components/KartraVideo";
import TabNav, { type Tab, type TabColor } from "@/components/TabNav";
import { IconArrow, IconDown, IconExternal, IconGroup, IconMail, IconPlus, IconStar } from "@/components/Icons";
import {
  assets,
  changes,
  copyright,
  disclaimer,
  extras,
  faqs,
  heroBullets,
  included,
  links,
  stats,
  steps,
  testimonials,
} from "@/content";

const REV = "Rev. 09/2026";

// The tab dividers are the only navigation. Pricing is the last, saffron
// tab: it leads out of the binder to the confirmed primary action.
const tabs: Tab[] = [
  { id: "workshop", label: "Workshop", color: "blue" },
  { id: "included", label: "Included", color: "navy" },
  { id: "results", label: "Results", color: "green" },
  { id: "faq", label: "FAQ", color: "red" },
  { id: "contact", label: "Contact", color: "slate" },
  { id: "pricing", label: "Pricing", color: "saffron", href: links.pricing },
];

const tabColor: Record<TabColor, string> = {
  navy: "var(--binder-edge)",
  saffron: "var(--saffron)",
  green: "var(--green)",
  red: "var(--red)",
  blue: "var(--blue)",
  slate: "#5b6b8c",
};

const tocTitles: Record<string, string> = {
  workshop: "Watch the workshop, then run it",
  included: "Everything in the binder",
  results: "What changes, and who says so",
  faq: "Common questions",
  contact: "Reach us",
  pricing: "Plans & Pricing",
};

// Other pages of the SPEED site, listed as further volumes in the Contents.
const volumes = [
  { label: "Home", href: links.home },
  { label: "Cloud", href: links.pricing },
  { label: "On Demand", href: links.onDemand },
  { label: "Testimonials", href: links.testimonials },
  { label: "Speaker Bio", href: links.speakerBio },
  { label: "SPEED Cloud login", href: links.login },
];

function Running({ tab }: { tab: string }) {
  return (
    <div className="running">
      <span>
        <b>SPEED</b> Operations Manual
      </span>
      <span className="hidden sm:inline">{tab}</span>
      <span>{REV}</span>
    </div>
  );
}

function Ring({ top }: { top: string }) {
  return (
    <>
      <div className="hole" style={{ top: `calc(${top} + 21px)` }} aria-hidden="true" />
      <div className="ring" style={{ top }} aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <defs>
            <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f6f8fb" />
              <stop offset="0.35" stopColor="#b3bac8" />
              <stop offset="0.55" stopColor="#eef1f6" />
              <stop offset="1" stopColor="#6f7787" />
            </linearGradient>
          </defs>
          {/* base plate riveted to the spine */}
          <rect x="2" y="22" width="22" height="20" rx="3" fill="url(#chrome)" stroke="rgba(0,0,0,0.4)" />
          <circle cx="8" cy="32" r="1.6" fill="rgba(0,0,0,0.5)" />
          <circle cx="18" cy="32" r="1.6" fill="rgba(0,0,0,0.5)" />
          {/* the ring, passing through the punched hole */}
          <circle cx="36" cy="32" r="22" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="10" />
          <circle cx="36" cy="32" r="22" fill="none" stroke="url(#chrome)" strokeWidth="8" />
          <circle
            cx="36"
            cy="32"
            r="22"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.5"
            strokeDasharray="30 108"
          />
        </svg>
      </div>
    </>
  );
}

function Stars() {
  return (
    <span className="stars" aria-label="Five stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStar key={i} />
      ))}
    </span>
  );
}

function ItemsTable({ rows, countHead }: { rows: typeof included; countHead: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="sheet">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">What you get</th>
            <th scope="col">{countHead}</th>
            <th scope="col">Used in</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.code}>
              <td className="sheet__code">{c.code}</td>
              <td className="sheet__name">{c.name}</td>
              <td className="sheet__limit">{c.limit}</td>
              <td className="sheet__tool">
                <span className="ticket">{c.tool}</span>
              </td>
              <td className="sheet__desc">{c.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <div className="spine" aria-hidden="true">
        <span className="spine__label">SPEED Training · Agency Operations Manual</span>
      </div>
      <Ring top="calc(18vh - 32px)" />
      <Ring top="calc(50vh - 32px)" />
      <Ring top="calc(82vh - 32px)" />

      <TabNav tabs={tabs} />

      <main className="binder">
        {/* ---------------------------------------------------------- Cover */}
        <section className="page page--cover" id="top">
          <header className="flex items-center justify-between gap-6 pb-4 mb-6 border-b border-rule">
            <a href={links.home} className="shrink-0" aria-label="SPEED Training home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assets.logo} alt="SPEED Training" width={150} height={44} className="h-9 w-auto" />
            </a>
            <span className="font-mono text-xs text-ink-3">Volume 1 · Customer Communication</span>
          </header>

          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 items-start">
            <div className="lg:col-span-7">
              <h1 className="display">
                Stop building from scratch. <span className="text-binder-edge">Start running a system.</span>
              </h1>
              <p className="lede mt-5">
                SPEED gives your team everything they need to communicate faster, more consistently, and more
                professionally, without creating a single template on their own.
              </p>

              <div className="mt-6 max-w-xl">
                <Checklist items={heroBullets.map((text) => ({ text }))} />
              </div>

              <p className="mt-5 font-bold text-ink">Most agencies start using templates the same day they enroll.</p>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <a href={links.pricing} className="btn btn--primary">
                  View Plans &amp; Pricing <IconArrow />
                </a>
                <a href="#workshop" className="btn btn--ghost">
                  Watch the workshop <IconDown />
                </a>
              </div>
            </div>

            <aside className="lg:col-span-5" aria-label="Contents">
              <div className="sleeve">
                <div className="sleeve__inner p-5 sm:p-6">
                  <h2 className="h3 flex items-baseline justify-between">
                    Contents
                    <span className="font-mono text-xs font-normal text-ink-3">{REV}</span>
                  </h2>
                  <ol className="toc mt-3">
                    {tabs.map((t, i) => (
                      <li key={t.id}>
                        <span className="toc__swatch" style={{ background: tabColor[t.color] }} aria-hidden="true" />
                        <a href={t.href ?? `#${t.id}`}>
                          <span>{tocTitles[t.id]}</span>
                          {t.href && <IconExternal className="w-3.5 h-3.5 text-ink-3 self-center" />}
                        </a>
                        <span className="toc__lead" aria-hidden="true" />
                        <span className="toc__pg">{t.href ? "Cloud" : `Tab ${i + 1}`}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="toc__vol">Other volumes</p>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.92rem] font-bold list-none p-0 m-0">
                    {volumes.map((v) => (
                      <li key={v.label}>
                        <a href={v.href} className="text-ink-2 hover:text-ink">
                          {v.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {stats.map((s, i) => (
                  <span key={s.value} className={`tape tape--big ${i % 2 ? "tape--tilt2" : "tape--tilt"}`}>
                    <b>{s.value}</b>
                    <span>{s.label}</span>
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm text-ink-3 font-mono">Agents coast to coast. Over 4,000 strong. One system that works.</p>
            </aside>
          </div>
        </section>

        {/* ------------------------------------------------------- Workshop */}
        <section className="page" id="workshop">
          <Running tab="Tab 1 · Workshop" />
          <span className="divider" style={{ "--divider": tabColor.blue } as React.CSSProperties} aria-hidden="true" />
          <h2 className="h2">Watch the workshop. Then run it.</h2>
          <p className="lede">
            SPEED is On Demand. Most offices complete it over 2 days with no travel and no time away from the office,
            and start using the templates the same day.
          </p>

          <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-12 items-start">
            <div className="lg:col-span-7">
              <KartraVideo />
              <p className="mt-3 text-sm text-ink-3 font-mono">Exhibit A · SPEED Workshop preview</p>
            </div>
            <div className="lg:col-span-5">
              <h3 className="h3 mb-3">Getting started, in order</h3>
              <Checklist
                numbered
                items={steps.map((s) => ({
                  num: s.n,
                  text: (
                    <>
                      <span className="block font-bold text-ink">{s.title}</span>
                      <span className="block text-ink-2 mt-0.5">{s.body}</span>
                    </>
                  ),
                }))}
              />
              <a href={links.onDemand} className="mt-5 inline-flex items-center gap-1.5 font-bold text-ink hover:text-tabblue">
                About the On Demand workshop <IconExternal className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- Included */}
        <section className="page" id="included">
          <Running tab="Tab 2 · What's Included" />
          <span className="divider" style={{ "--divider": tabColor.navy } as React.CSSProperties} aria-hidden="true" />
          <h2 className="h2">Everything in the binder.</h2>
          <p className="lede">
            Every item is written for a State Farm office and names the tool it plugs into. Nothing is sold
            separately; it works because it works together.
          </p>

          <div className="mt-8">
            <ItemsTable rows={included} countHead="Count" />
          </div>

          <h3 className="h3 mt-12 mb-3">Also in the binder</h3>
          <ItemsTable rows={extras} countHead="Cadence" />

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a href={links.pricing} className="btn btn--primary">
              View Plans &amp; Pricing <IconArrow />
            </a>
            <span className="text-sm text-ink-3">Pricing lives on the Cloud page.</span>
          </div>
        </section>

        {/* -------------------------------------------------------- Results */}
        <section className="page" id="results">
          <Running tab="Tab 3 · Results" />
          <span className="divider" style={{ "--divider": tabColor.green } as React.CSSProperties} aria-hidden="true" />
          <h2 className="h2">What changes when your agency runs on SPEED.</h2>
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 items-start">
            <div className="lg:col-span-5">
              <p className="lede">
                Most agencies are building from scratch every day: rewriting the same emails, recreating the same
                scripts, hoping the next team member figures it out as fast as the last one did. SPEED replaces that
                with a system.
              </p>
              <p className="mt-6 font-bold text-ink max-w-measure">
                SPEED is more than training. It&apos;s the operating system your agency runs on.
              </p>
            </div>
            <div className="lg:col-span-7 lg:pt-1">
              <Checklist items={changes.map((text) => ({ text }))} />
            </div>
          </div>

          <h3 className="h3 mt-14 mb-2">From agents who run it</h3>
          <p className="body mb-6">
            Used by agencies ranging from brand-new TICAs to Chairman&apos;s Circle and Trophy Club agents.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {testimonials.map((t) => (
              <blockquote key={t.where} className="memo">
                <Stars />
                <p className="mt-3">{t.quote}</p>
                <footer>
                  <cite className="not-italic">
                    &mdash; {t.who}, {t.where}
                  </cite>
                </footer>
              </blockquote>
            ))}
          </div>
          <a href={links.testimonials} className="mt-6 inline-flex items-center gap-1.5 font-bold text-ink hover:text-tabblue">
            See how other agents use SPEED <IconExternal className="w-4 h-4" />
          </a>
        </section>

        {/* ------------------------------------------------------------ FAQ */}
        <section className="page" id="faq">
          <Running tab="Tab 4 · Common questions" />
          <span className="divider" style={{ "--divider": tabColor.red } as React.CSSProperties} aria-hidden="true" />
          <h2 className="h2">Common questions about SPEED Training.</h2>
          <div className="faq mt-8 max-w-4xl">
            {faqs.map((f) => (
              <details key={f.q}>
                <summary>
                  <span>{f.q}</span>
                  <IconPlus />
                </summary>
                <div className="answer body">
                  {f.a.map((p, i) => (
                    <p key={i}>
                      {p.includes("support@speedtrainingworkshop.com") ? (
                        <>
                          {p.split("support@speedtrainingworkshop.com")[0]}
                          <a href={links.support} className="font-bold text-ink">
                            support@speedtrainingworkshop.com
                          </a>
                          {p.split("support@speedtrainingworkshop.com")[1]}
                        </>
                      ) : (
                        p
                      )}
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- Contact */}
        <section className="page" id="contact">
          <Running tab="Tab 5 · Contact" />
          <span className="divider" style={{ "--divider": tabColor.slate } as React.CSSProperties} aria-hidden="true" />
          <h2 className="h2">Reach us.</h2>
          <p className="lede">Email is the best way. We&apos;d love to hear from you and will get in touch shortly.</p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2 max-w-3xl list-none p-0 m-0">
            <li className="sm:col-span-2">
              <a href={links.support} className="btn btn--wrap w-full justify-start">
                <IconMail />
                <span>
                  support@<wbr />speedtrainingworkshop.com
                </span>
              </a>
            </li>
            <li>
              <a
                href="https://www.speedtrainingworkshop.com/home/DwQ69#_bp5qk69kz"
                className="btn btn--wrap w-full justify-start"
              >
                <IconArrow /> Contact form / join our list
              </a>
            </li>
            <li>
              <a href={links.facebookGroup} className="btn btn--wrap w-full justify-start" target="_blank" rel="noopener">
                <IconGroup /> Facebook group
              </a>
            </li>
            <li>
              <a href={links.facebookPage} className="btn btn--wrap w-full justify-start" target="_blank" rel="noopener">
                <IconExternal /> Facebook page
              </a>
            </li>
          </ul>
          <p className="mt-4 text-sm text-ink-3">We hate spam as much as you.</p>

          <div className="mt-14 pt-10 border-t-2 border-ink">
            <p className="display" style={{ fontSize: "clamp(1.9rem, 3.6vw, 3.2rem)", maxWidth: "22ch" }}>
              Start today. Most agencies begin implementing templates the same day they enroll.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a href={links.pricing} className="btn btn--primary">
                View Plans &amp; Pricing <IconArrow />
              </a>
              <a href={links.instantAccess} className="btn btn--ghost">
                Get instant access to SPEED
              </a>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- Back cover */}
        <footer className="page page--back" id="back">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-7">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assets.logo} alt="SPEED Training" width={150} height={44} className="h-9 w-auto brightness-0 invert" />
              <p className="mt-5 text-sm text-on-binder-2 max-w-measure">{copyright}</p>
              <p className="mt-3 text-sm text-on-binder-2 max-w-measure">{disclaimer}</p>
              <p className="mt-3 text-sm text-on-binder-2 max-w-measure">
                SPEED is a Non-State Farm Vendor. We have no connectivity to State Farm systems and no customer or
                consumer information is ever shared.
              </p>
            </div>
            <nav className="md:col-span-5 md:justify-self-end" aria-label="Legal">
              <ul className="list-none p-0 m-0 grid gap-2 text-sm font-bold">
                <li>
                  <a href={links.speakerBio} className="text-on-binder hover:text-saffron">
                    About Us
                  </a>
                </li>
                <li>
                  <a href={links.support} className="text-on-binder hover:text-saffron">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href={links.terms} className="text-on-binder hover:text-saffron">
                    Terms of Use
                  </a>
                </li>
                <li>
                  <a href={links.privacy} className="text-on-binder hover:text-saffron">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href={links.login} className="text-on-binder hover:text-saffron">
                    SPEED Cloud login
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </footer>
      </main>
    </>
  );
}

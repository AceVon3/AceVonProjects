import Link from "next/link";
import "../landing.css";

export const metadata = {
  title: "Privacy — AgencyMan.ai",
  description: "What AgencyMan.ai collects, why, and what we never do with it.",
};

// Plain-language privacy policy. Marketing-styled (lp tokens) so it reads
// as part of the funnel. Keep this page in sync with what the product
// actually stores: Clerk holds credentials; our Postgres holds the agency
// profile; nothing is sold or shared for advertising.
export default function PrivacyPage() {
  return (
    <div className="lp" style={{ minHeight: "100vh" }}>
      <div className="wrap" style={{ maxWidth: 720, padding: "48px 24px 96px" }}>
        <Link href="/" style={{ fontWeight: 800, textDecoration: "none" }}>
          AgencyMan<span style={{ color: "var(--brand)" }}>.ai</span>
        </Link>

        <h1 style={{ fontSize: "1.8rem", margin: "28px 0 6px", letterSpacing: "-0.01em" }}>
          Privacy policy
        </h1>
        <p style={{ color: "var(--ink-mute)", marginTop: 0 }}>Last updated July 14, 2026</p>

        {/* div, not <section> — .lp section carries the landing page's
            96px band padding, which would blow this layout apart */}
        <div style={{ color: "var(--ink-soft)", lineHeight: 1.7 }}>
          <h2 style={{ fontSize: "1.15rem", color: "var(--ink)", margin: "28px 0 8px" }}>
            What we collect
          </h2>
          <p>
            <b>Account details.</b> When you create an account we collect your
            email address, name, and a password. Credentials are handled and
            stored by our authentication provider,{" "}
            <a href="https://clerk.com/privacy" style={{ color: "var(--brand)" }}>
              Clerk
            </a>{" "}
            — we never see or store your password.
          </p>
          <p>
            <b>Your agency profile.</b> The details you enter during setup —
            agency type, carriers sold, licensed states, office addresses,
            team size and states, pay structure — are stored in our database
            so your profile follows your account across devices.
          </p>
          <p>
            <b>That&apos;s it.</b> We don&apos;t collect browsing history,
            we don&apos;t use advertising trackers, and the rate-filing data
            you view is public information that never gets tied to your
            account.
          </p>

          <h2 style={{ fontSize: "1.15rem", color: "var(--ink)", margin: "28px 0 8px" }}>
            How we use it
          </h2>
          <p>
            Solely to run the product: your profile personalizes the Prospect,
            Defend, My Carriers, and Compliance views to your states and
            carriers. We may email you about your account or important product
            changes — not marketing blasts.
          </p>

          <h2 style={{ fontSize: "1.15rem", color: "var(--ink)", margin: "28px 0 8px" }}>
            What we never do
          </h2>
          <p>
            We don&apos;t sell your data. We don&apos;t share it with
            advertisers, carriers, or other agents. Your book of business is
            your business.
          </p>

          <h2 style={{ fontSize: "1.15rem", color: "var(--ink)", margin: "28px 0 8px" }}>
            Where it lives
          </h2>
          <p>
            Accounts are managed by Clerk; profile data is stored in a Neon
            Postgres database; the site is hosted on Vercel. All three are
            established providers with their own security and privacy
            programs, and data is encrypted in transit.
          </p>

          <h2 style={{ fontSize: "1.15rem", color: "var(--ink)", margin: "28px 0 8px" }}>
            Deleting your data
          </h2>
          <p>
            Email{" "}
            <a href="mailto:privacy@agencyman.ai" style={{ color: "var(--brand)" }}>
              privacy@agencyman.ai
            </a>{" "}
            from your account address and we&apos;ll delete your account and
            profile.
          </p>
        </div>
      </div>
    </div>
  );
}

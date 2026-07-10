import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AgencyMan.ai — Know every rate move in your market",
  description:
    "AgencyMan.ai turns state rate filings into sales signals for insurance agents: who's raising rates in your states, who's cutting them, and how your carrier is positioned.",
};

// Resolve the landing page's theme before paint (saved choice -> system
// preference) so there's no light/dark flash. Scoped to data-lp-theme so
// it can't collide with the app's styling. The lp-js class gates the
// scroll-reveal animation so content is never hidden without JS.
const themeInit = `
(function () {
  try {
    document.documentElement.classList.add("lp-js");
    var t = localStorage.getItem("am-theme");
    if (t !== "light" && t !== "dark") {
      t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-lp-theme", t);
  } catch (e) {}
})();
`;

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      {children}
    </>
  );
}

import type { Metadata } from "next";
import { Archivo, Courier_Prime } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const courier = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-courier",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SPEED Training Workshop",
  description:
    "Stop building from scratch. Start running a system. SPEED gives State Farm agencies 125+ email templates, 60+ text scripts, follow-up plans, and an On Demand workshop the whole team can use the same day.",
  icons: {
    icon: "https://kartrausers.s3.amazonaws.com/speedtraining/2_639538e259583_Square.jpg",
  },
  openGraph: {
    title: "SPEED Training Workshop",
    description: "Systems and processes for State Farm agencies. 4,000+ agents and team members nationwide.",
    images: ["https://d11n7da8rpqbjy.cloudfront.net/tmtrainer/31036373_1670276450cdWSPEED_Square.png"],
  },
};

// Direction contract (impeccable). Emitted as an HTML comment as the first
// child of <body> so it survives the production build and can be audited.
const contract = `<!--
impeccable direction contract · seed 9a6af889
THESIS: A State Farm agency's customer-communication system presented as the operations binder already on every agent's desk; refuses the dark hero + stat row + icon-card grid course page.
OWN-WORLD: navy vinyl binder frame with chrome rings and a spine label; white bond pages with a running header; colored tab dividers (saffron, red, green, blue, navy) as the only navigation; label-maker tape for small facts; sheet-protector gloss over media; ruled checklist rows whose ink checks draw in; Archivo caps and a typewriter memo face.
STORY: an agent recognizes their own office binder, reads the system already written out, believes it works (4,000+, Chairman's Circle quotes), and clicks View Plans & Pricing.
FIRST VIEWPORT: binder open on the first page: left column headline, lede, three-item checklist and the saffron tab-shaped pricing button; right column the Contents sheet with colored swatches and dot leaders plus the four stats as tape labels; tab dividers down the right edge, rings on the left.
FORM: The Operations Binder, candidate 1 of 7 (IMPECCABLE'S PICK), code-led, seed 9a6af889.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${archivo.variable} ${courier.variable}`}>
      <body>
        <div hidden aria-hidden="true" dangerouslySetInnerHTML={{ __html: contract }} />
        {children}
      </body>
    </html>
  );
}

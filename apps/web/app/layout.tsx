import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { SITE } from "@/lib/site";
import { SideProvider } from "@/lib/side";
import { Starfield } from "@/components/Starfield";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Sections";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin", "latin-ext"], variable: "--font-display", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-hud", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: where roleplay is happening in SWTOR`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: "SithCult", url: SITE.github }],
  keywords: ["SWTOR", "Star Wars: The Old Republic", "roleplay", "RP", "map", "companion app", "overlay"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name}: where roleplay is happening in SWTOR`,
    description: SITE.tagline + " Free and open source.",
    url: SITE.url,
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "The Hydian icon next to the words: See where roleplay is happening.",
      },
    ],
  },
  twitter: { card: "summary_large_image", title: SITE.name, description: SITE.tagline, images: ["/og.png"] },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#06091a", colorScheme: "dark" };

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: SITE.name,
      url: SITE.url,
      applicationCategory: "GameApplication",
      operatingSystem: "Windows, macOS",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/licenses/MIT",
      description: SITE.description,
      image: `${SITE.url}/og.png`,
      author: { "@type": "Organization", name: "SithCult", url: SITE.github },
    },
    {
      "@type": "Organization",
      name: "SithCult",
      url: SITE.url,
      logo: `${SITE.url}/icon-512.png`,
      email: "hello@hydian.org",
      contactPoint: [
        { "@type": "ContactPoint", contactType: "legal", email: "legal@hydian.org" },
        { "@type": "ContactPoint", contactType: "security", email: "security@hydian.org" },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-side="republic" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <SideProvider>
          <Starfield />
          <Nav />
          {children}
          <Footer />
        </SideProvider>
      </body>
    </html>
  );
}

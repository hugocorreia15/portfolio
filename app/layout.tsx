import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Instrument_Sans } from "next/font/google";
import { profile } from "@/data/profile";
import { PERSON_JSON_LD, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = `${profile.name} — ${profile.title}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s — ${profile.name}` },
  description: SITE_DESCRIPTION,
  authors: [{ name: profile.name, url: SITE_URL }],
  keywords: [
    "Hugo Correia",
    "HCI",
    "Human-Computer Interaction",
    "eye tracking",
    "usability evaluation",
    "virtual reality",
    "University of Aveiro",
    "IEETA",
    "software engineer",
    "portfolio",
  ],
  openGraph: {
    type: "profile",
    title: TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: `${profile.name} · Ria de Aveiro`,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: SITE_DESCRIPTION },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#d8edf2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrument.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(PERSON_JSON_LD).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}

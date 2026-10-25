import { profile } from "@/data/profile";

/** Public origin: Vercel's production domain at build time, the known alias otherwise. */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://portfolio-roan-six-76.vercel.app";

export const SITE_DESCRIPTION =
  "HCI researcher and software engineer from Aveiro: eye tracking, usability evaluation and XR. Sail a moliceiro through the Ria de Aveiro to explore my research, publications and projects.";

/** schema.org Person, rendered as JSON-LD in the root layout. */
export const PERSON_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  jobTitle: profile.title,
  url: SITE_URL,
  image: `${SITE_URL}/images/hugo-portrait.jpg`,
  email: `mailto:${profile.emailAlt}`,
  address: { "@type": "PostalAddress", addressLocality: "Aveiro", addressCountry: "PT" },
  alumniOf: { "@type": "CollegeOrUniversity", name: "University of Aveiro" },
  knowsAbout: profile.researchInterests,
  sameAs: [profile.github, profile.linkedin, profile.orcid],
};

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/cv`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/credits`, changeFrequency: "yearly", priority: 0.2 },
  ];
}

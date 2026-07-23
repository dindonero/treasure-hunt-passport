import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cadaval.treasurehunt.pt";

const lastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${baseUrl}/`, changeFrequency: "daily", priority: 1, lastModified },
    { url: `${baseUrl}/leaderboard`, changeFrequency: "hourly", priority: 0.9, lastModified },
    { url: `${baseUrl}/most-found`, changeFrequency: "hourly", priority: 0.7, lastModified },
    { url: `${baseUrl}/map`, changeFrequency: "weekly", priority: 0.6, lastModified },
    { url: `${baseUrl}/dashboard`, changeFrequency: "daily", priority: 0.5, lastModified },
    { url: `${baseUrl}/merch`, changeFrequency: "weekly", priority: 0.5, lastModified },
    { url: `${baseUrl}/merch-history`, changeFrequency: "hourly", priority: 0.4, lastModified },
  ];
}

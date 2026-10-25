import type { Metadata } from "next";
import { SITE } from "./site";

// Child pages replace the layout's openGraph and twitter blocks wholesale, so each page passes its own title and
// description through here; otherwise link previews show the home page's title everywhere.
export const OG_BASE = { type: "website", siteName: SITE.name, locale: "en_US" } as const;

export function pageMeta(title: string, description: string, path: string): Metadata {
  const full = `${title} · ${SITE.name}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OG_BASE, title: full, description, url: path },
    twitter: { card: "summary_large_image", title: full, description },
  };
}

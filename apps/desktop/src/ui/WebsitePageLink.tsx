import { isTauri } from "../core/fs";
import { openWebsitePage, WEBSITE_PAGES, type WebsitePage } from "../core/website";

export function WebsitePageLink({ page }: { page: WebsitePage }) {
  const { url, label } = WEBSITE_PAGES[page];
  return (
    <a
      className="privacy-policy-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (!isTauri()) return;
        event.preventDefault();
        void openWebsitePage(page);
      }}
    >
      {label} ↗
    </a>
  );
}

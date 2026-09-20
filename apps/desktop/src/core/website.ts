import { useApp } from "../store";

export const WEBSITE_PAGES = {
  privacy: { url: "https://hydian.org/privacy", label: "Privacy policy" },
  about: { url: "https://hydian.org/about", label: "About Hydian" },
} as const;

export type WebsitePage = keyof typeof WEBSITE_PAGES;

export async function openWebsitePage(page: WebsitePage) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_website_page", { page });
  } catch {
    const address = WEBSITE_PAGES[page].url.replace("https://", "");
    useApp.getState().toast(`Could not open this page. Visit ${address} in your browser.`, "warn");
  }
}

import type { NextConfig } from "next";

// Static export: the site ships to Cloudflare Pages as files. Dynamic routes (forum, guild registry) move this
// to OpenNext later; nothing in the pages depends on the export mode.
const config: NextConfig = {
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default config;

"use client";

import { useDesktopOs } from "@/lib/platform";
import { AppleLogo, WindowsLogo } from "./OsLogos";

export function PlatformDownloadLinks() {
  const os = useDesktopOs();
  const platforms = os === "mac" ? ["mac", "windows"] : ["windows", "mac"];
  return platforms.map((platform, index) => (
    <a key={platform} className={index === 0 ? "btn primary" : "btn"} href="/download">
      {platform === "mac" ? <AppleLogo /> : <WindowsLogo />}
      {platform === "mac" ? "macOS" : "Windows"}
    </a>
  ));
}

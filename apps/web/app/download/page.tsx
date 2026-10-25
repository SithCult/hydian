import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { Downloads } from "@/components/Downloads";

export const metadata: Metadata = pageMeta(
  "Download",
  "Hydian for Windows and macOS. Free, open source, no account.",
  "/download",
);

export default function DownloadPage() {
  return (
    <main>
      <Downloads />
    </main>
  );
}

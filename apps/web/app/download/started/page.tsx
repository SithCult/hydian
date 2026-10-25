import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { Started } from "@/components/Started";

export const metadata: Metadata = {
  ...pageMeta(
    "Download started",
    "Your Hydian download has started. What Windows asks on the first launch, and what to do next.",
    "/download/started",
  ),
  robots: { index: false },
};

export default function StartedPage() {
  return (
    <main>
      <Started />
    </main>
  );
}

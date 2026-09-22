import type { Metadata } from "next";
import { Started } from "@/components/Started";

export const metadata: Metadata = {
  title: "Download started",
  description: "Your Hydian download has started. What Windows asks on the first launch, and what to do next.",
  alternates: { canonical: "/download/started" },
  robots: { index: false },
};

export default function StartedPage() {
  return (
    <main>
      <Started />
    </main>
  );
}

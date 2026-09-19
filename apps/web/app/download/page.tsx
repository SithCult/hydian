import type { Metadata } from "next";
import { Downloads } from "@/components/Downloads";

export const metadata: Metadata = {
  title: "Download",
  description: "Hydian for Windows and macOS. Free, open source, no account.",
  alternates: { canonical: "/download" },
};

export default function DownloadPage() {
  return (
    <main>
      <Downloads />
    </main>
  );
}

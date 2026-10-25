import { OG_SIZE, ogImage } from "@/lib/og";

export const alt = "The Hydian icon with the words: How Hydian handles your data.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return ogImage({
    kicker: "Privacy",
    title: "How Hydian handles your data.",
    line: "What stays on your device, what is shared, and the choices you have.",
  });
}

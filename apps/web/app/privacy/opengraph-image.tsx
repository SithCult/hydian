import { OG_SIZE, ogImage, type OgCard } from "@/lib/og";

const CARD: OgCard = {
  kicker: "Privacy",
  title: "How Hydian handles your data.",
  line: "What stays on your device, what is shared, and the choices you have.",
};

export const alt = CARD.title;
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return ogImage(CARD);
}

import { OG_SIZE, ogImage, type OgCard } from "@/lib/og";

const CARD: OgCard = {
  kicker: "About Hydian",
  title: "Bringing roleplay back into the open world.",
  line: "Made by roleplayers who wanted to find each other outside the hotspots.",
};

export const alt = CARD.title;
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return ogImage(CARD);
}

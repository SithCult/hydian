import { OG_SIZE, ogImage, type OgCard } from "@/lib/og";

const CARD: OgCard = {
  kicker: "SWTOR roleplay companion",
  title: "Find roleplay beyond the hotspots.",
  line: "Share where your character is, even a quiet corner of Balmorra, and others can join your scene.",
};

export const alt = CARD.title;
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return ogImage(CARD);
}

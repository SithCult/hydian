import { OG_SIZE, ogImage } from "@/lib/og";

export const alt = "The Hydian icon over a roleplay gathering, with the words: Find roleplay beyond the hotspots.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return ogImage({
    kicker: "SWTOR roleplay companion",
    title: "Find roleplay beyond the hotspots.",
    line: "Share where your character is, even a quiet corner of Balmorra, and others can join your scene.",
  });
}

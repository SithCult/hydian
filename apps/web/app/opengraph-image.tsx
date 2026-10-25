import { OG_SIZE, ogImage } from "@/lib/og";

export const alt = "The Hydian icon over a roleplay gathering, with the words: Your next scene is already on the map.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return ogImage({
    kicker: "SWTOR roleplay companion",
    title: "Your next scene is already on the map.",
    line: "Roleplay anywhere, not just the hotspots. Someone can find you, even on a quiet corner of Balmorra.",
  });
}

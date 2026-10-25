import { OG_SIZE, ogImage } from "@/lib/og";

export const alt = "The Hydian icon with the words: Bringing roleplay back into the open world.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return ogImage({
    kicker: "About Hydian",
    title: "Bringing roleplay back into the open world.",
    line: "Made by roleplayers who wanted to find each other outside the hotspots.",
  });
}

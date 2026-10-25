import { OG_SIZE, ogImage } from "@/lib/og";

export const alt =
  "The Hydian icon over a roleplay gathering, with the words: See who is roleplaying, wherever they are.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return ogImage({
    kicker: "SWTOR roleplay companion",
    title: "See who's roleplaying, wherever they are.",
    line: "Even on a quiet corner of Balmorra, other roleplayers can find you and join your scene.",
  });
}

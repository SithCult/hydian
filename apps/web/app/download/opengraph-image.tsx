import { OG_SIZE, ogImage } from "@/lib/og";

export const alt = "The Hydian icon with the words: Ready to meet new people on Hydian?";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return ogImage({
    kicker: "Download Hydian",
    title: "Ready to meet new people on Hydian?",
    line: "Free and open source. No account needed.",
  });
}

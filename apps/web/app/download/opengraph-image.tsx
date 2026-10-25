import { OG_SIZE, ogImage, type OgCard } from "@/lib/og";

const CARD: OgCard = {
  kicker: "Download Hydian",
  title: "Ready to meet new people on Hydian?",
  line: "Free and open source. No account needed.",
};

export const alt = CARD.title;
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return ogImage(CARD);
}

// Share images (og:image) for every page, drawn at build time in the style of the home page's closing panel:
// the temple gathering faded behind the icon, a big headline and one quiet line under it.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

const asset = (name: string) => readFile(join(process.cwd(), "assets/og", name));
const dataUrl = async (name: string, type: string) => `data:${type};base64,${(await asset(name)).toString("base64")}`;

export type OgCard = { kicker: string; title: string; line: string };

export async function ogImage({ kicker, title, line }: OgCard) {
  const [display, body, hud, photo, icon] = await Promise.all([
    asset("SpaceGrotesk-Bold.ttf"),
    asset("Inter-Regular.ttf"),
    asset("IBMPlexMono-Medium.ttf"),
    dataUrl("temple.jpg", "image/jpeg"),
    dataUrl("icon.png", "image/png"),
  ]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background: "#06091a",
        color: "#ffffff",
        fontFamily: "Inter",
        textAlign: "center",
      }}
    >
      <div
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", opacity: 0.24 }}
      >
        <img src={photo} width={1200} height={675} style={{ position: "absolute", top: -30, left: 0 }} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundImage: "linear-gradient(180deg, rgba(6, 9, 26, 0.62) 0%, rgba(6, 9, 26, 0.8) 55%, #06091a 100%)",
        }}
      />
      <img src={icon} width={132} height={132} style={{ marginBottom: 34, boxShadow: "0 30px 50px rgba(0,0,0,0.6)" }} />
      <div
        style={{
          display: "flex",
          fontFamily: "Plex Mono",
          fontSize: 20,
          letterSpacing: 5,
          textTransform: "uppercase",
          color: "#e9c87a",
          marginBottom: 18,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Space Grotesk",
          fontSize: 76,
          lineHeight: 1,
          letterSpacing: -2.5,
          maxWidth: 980,
          justifyContent: "center",
          textWrap: "balance",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          fontSize: 27,
          color: "#a3aac0",
          marginTop: 26,
          maxWidth: 860,
          textWrap: "balance",
        }}
      >
        {line}
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Space Grotesk", data: display, weight: 700, style: "normal" },
        { name: "Inter", data: body, weight: 400, style: "normal" },
        { name: "Plex Mono", data: hud, weight: 500, style: "normal" },
      ],
    },
  );
}

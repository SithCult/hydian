export const SITE = {
  name: "Hydian",
  url: "https://www.hydian.org",
  tagline: "Where roleplay is happening in SWTOR.",
  description:
    "See who is roleplaying in SWTOR and where, on the in-game maps. Find scenes away from the hotspots, or be found on a quiet corner of Balmorra. Free and open source.",
  github: "https://github.com/SithCult/hydian",
  releases: "https://github.com/SithCult/hydian/releases/latest",
  downloads: "https://dl.hydian.org", // installers, published by .github/workflows/publish.yml
  tiles: process.env.NEXT_PUBLIC_TILES ?? "https://tiles.hydian.org/",
  disclaimer:
    "Hydian is a fan project, not affiliated with Electronic Arts, BioWare, Broadsword or Lucasfilm. Star Wars: The Old Republic and related marks belong to their owners.",
};

export const SERVERS = [
  { id: "he3000", name: "Star Forge", short: "SF", region: "NA" },
  { id: "he3001", name: "Satele Shan", short: "SS", region: "NA" },
  { id: "he4000", name: "Darth Malgus", short: "DM", region: "EU" },
  { id: "he4001", name: "Tulak Hord", short: "TH", region: "EU" },
  { id: "he4002", name: "The Leviathan", short: "LV", region: "EU" },
  { id: "he4003", name: "Shae Vizla", short: "SV", region: "APAC" },
] as const;

export type Side = "republic" | "empire";

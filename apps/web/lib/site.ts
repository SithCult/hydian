export const SITE = {
  name: "Hydian",
  url: "https://hydian.org",
  tagline: "Where roleplay is happening in SWTOR.",
  description:
    "Free, open-source desktop companion for roleplay in Star Wars: The Old Republic. See who is In Character where, on the in-game maps. No account needed.",
  github: "https://github.com/SithCult/hydian",
  releases: "https://github.com/SithCult/hydian/releases/latest",
  downloads: "https://dl.hydian.org", // installers, published by .github/workflows/publish.yml
  api: process.env.NEXT_PUBLIC_API ?? "https://api-production-2fef.up.railway.app",
  tiles: process.env.NEXT_PUBLIC_TILES ?? "https://tiles-production-d7fc.up.railway.app/",
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

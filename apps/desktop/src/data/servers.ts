export interface Server {
  id: string;
  name: string;
  short: string;
  region: "NA" | "EU" | "APAC";
  hue: number;
}

export const SERVERS: Server[] = [
  { id: "he3000", name: "Star Forge", short: "SF", region: "NA", hue: 200 },
  { id: "he3001", name: "Satele Shan", short: "SS", region: "NA", hue: 40 },
  { id: "he4000", name: "Darth Malgus", short: "DM", region: "EU", hue: 0 },
  { id: "he4001", name: "Tulak Hord", short: "TH", region: "EU", hue: 280 },
  { id: "he4002", name: "The Leviathan", short: "LV", region: "EU", hue: 160 },
  { id: "he4003", name: "Shae Vizla", short: "SV", region: "APAC", hue: 320 },
];

export const serverById = (id: string) => SERVERS.find((s) => s.id === id);

export const CLASSES: Record<string, { faction: "imp" | "rep"; role: string; color: string }> = {
  "Sith Warrior": { faction: "imp", role: "Warrior", color: "#ef4444" },
  Juggernaut: { faction: "imp", role: "Warrior", color: "#ef4444" },
  Marauder: { faction: "imp", role: "Warrior", color: "#f97316" },
  "Sith Inquisitor": { faction: "imp", role: "Inquisitor", color: "#a855f7" },
  Assassin: { faction: "imp", role: "Inquisitor", color: "#a855f7" },
  Sorcerer: { faction: "imp", role: "Inquisitor", color: "#c084fc" },
  "Bounty Hunter": { faction: "imp", role: "Hunter", color: "#f59e0b" },
  Mercenary: { faction: "imp", role: "Hunter", color: "#f59e0b" },
  Powertech: { faction: "imp", role: "Hunter", color: "#fbbf24" },
  "Imperial Agent": { faction: "imp", role: "Agent", color: "#38bdf8" },
  Operative: { faction: "imp", role: "Agent", color: "#38bdf8" },
  Sniper: { faction: "imp", role: "Agent", color: "#0ea5e9" },
  "Jedi Knight": { faction: "rep", role: "Knight", color: "#60a5fa" },
  Guardian: { faction: "rep", role: "Knight", color: "#60a5fa" },
  Sentinel: { faction: "rep", role: "Knight", color: "#3b82f6" },
  "Jedi Consular": { faction: "rep", role: "Consular", color: "#34d399" },
  Sage: { faction: "rep", role: "Consular", color: "#34d399" },
  Shadow: { faction: "rep", role: "Consular", color: "#10b981" },
  Trooper: { faction: "rep", role: "Trooper", color: "#facc15" },
  Vanguard: { faction: "rep", role: "Trooper", color: "#facc15" },
  Commando: { faction: "rep", role: "Trooper", color: "#eab308" },
  Smuggler: { faction: "rep", role: "Smuggler", color: "#fb923c" },
  Gunslinger: { faction: "rep", role: "Smuggler", color: "#fb923c" },
  Scoundrel: { faction: "rep", role: "Smuggler", color: "#f97316" },
};

// Faction from the class the log reports. The class itself is never served; the faction is RP-relevant and
// obvious in game anyway (the name plate colour), so it may leave.
const IMP = new Set([
  "sith warrior",
  "juggernaut",
  "marauder",
  "sith inquisitor",
  "assassin",
  "sorcerer",
  "bounty hunter",
  "mercenary",
  "powertech",
  "imperial agent",
  "operative",
  "sniper",
]);
const REP = new Set([
  "jedi knight",
  "guardian",
  "sentinel",
  "jedi consular",
  "sage",
  "shadow",
  "trooper",
  "vanguard",
  "commando",
  "smuggler",
  "gunslinger",
  "scoundrel",
]);

export type Faction = "imp" | "rep";

export function factionOf(cls: string | null | undefined): Faction | null {
  if (!cls) return null;
  const c = cls.trim().toLowerCase();
  if (IMP.has(c)) return "imp";
  if (REP.has(c)) return "rep";
  return null;
}

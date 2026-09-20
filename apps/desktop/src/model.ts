export type RPStatus = "ic" | "ooc" | "invisible";

export const STATUS_META: Record<RPStatus, { label: string; short: string; color: string; hint: string }> = {
  ic: { label: "In Character", short: "IC", color: "#23a55a", hint: "Roleplaying right now. Approach in character" },
  ooc: {
    label: "Out of Character",
    short: "OOC",
    color: "#f0b232",
    hint: "On the map, but not roleplaying at the moment",
  },
  invisible: {
    label: "Invisible",
    short: "OFF",
    color: "#949ba4",
    hint: "Hidden from Hydian’s public map and player lists",
  },
};
/** Looking-for-RP is a flag on top of the status, not a status of its own. */
export const LFRP_COLOR = "#8fdcff";
/** Server instances ("Nar Shaddaa 2") are not in the combat log, so the player sets it by hand; cleared on zone change. */
export interface CharStatus {
  status: RPStatus;
  lfrp: boolean;
  instance?: number | null;
}
export const DEFAULT_STATUS: CharStatus = { status: "invisible", lfrp: false, instance: null }; // sharing is opt-in per character
export const INSTANCES = [1, 2, 3, 4, 5, 6] as const;

/** Presence windows for the client display.
 *  Idle/RP sessions can be silent in the combat log for a long time (p99 gap 13 min, max seen 47 min),
 *  so "active" is generous and "gone" is well past the longest real silence. */
export const PRESENCE = { activeMs: 10 * 60_000, staleMs: 45 * 60_000 } as const;
export const presenceOf = (lastActive: number, now = Date.now()): "active" | "idle" | "gone" =>
  !lastActive
    ? "gone"
    : now - lastActive < PRESENCE.activeMs
      ? "active"
      : now - lastActive < PRESENCE.staleMs
        ? "idle"
        : "gone";

export interface Player {
  key: string; // `${server}:${charId}`
  id: string; // stable in-game character id
  name: string;
  server: string;
  cls: string | null;
  disc: string | null;
  faction?: "imp" | "rep" | null; // own characters: from the class; others: served by the API
  planetId: string | null; // area id
  areaName: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  status: RPStatus;
  lfrp?: boolean;
  instance?: number | null; // manual instance number, if the player set one
  hue: number; // avatar colour, hueOf(id)
  lastActive: number; // epoch ms
  isMe?: boolean;
  isSeen?: boolean; // sighted in your own combat log (local only, not registered)
}

/** Avatar colour: derived from the character id, so it is stable and needs no storage. */
export const hueOf = (id: string) => (Number(id.slice(-3)) * 7) % 360;

/** Public presence is opt-in and expires when gameplay activity stops. */
export const isPublicPlayer = (p: Player, now = Date.now()) =>
  !p.isSeen && (p.status === "ic" || p.status === "ooc") && presenceOf(p.lastActive, now) !== "gone";

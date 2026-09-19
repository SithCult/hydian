// Demo population for screenshots: `index.html?demo=1` in the browser dev flow. Nothing is read from the
// game and nothing is sent; the store boots without the game link and the uplink stays off.
import type { Player } from "../model";
import type { PersonNote } from "./notes";
import type { Area, Position, SessionState } from "./parser";
import type { CharacterSnapshot } from "./gamelink";
import type { AppState } from "../store";
import { hueOf } from "../model";
import { SCALE } from "../data/maps";

export const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has("demo");
/** `&zoom=6`: map scale to frame the own character at, for captures. */
export const DEMO_ZOOM = DEMO ? Number(new URLSearchParams(location.search).get("zoom")) || null : null;

const SERVER = "he4000"; // Darth Malgus
const NAR_SHADDAA: Area = { name: "Nar Shaddaa", id: "137438987989", mode: null, modeId: null };

// [name, class, status, lfrp, x, y, z (map units, scaled to log units below), minutes ago]
type Row = [string, string, "ic" | "ooc", boolean, number, number, number, number];

// Lower Promenade cantina floor (h 50.4..55.3), Upper Promenade (h 53.1..55.1),
// Star Cluster Casino (h 105.5..111.9), Old Lenstrum Market (h -144.6..-143.5)
const ROWS: Row[] = [
  // around the cantina bar, Lower Promenade
  ["Vashti Arano", "Sith Warrior", "ic", false, -108.3, -83.8, 52.1, 1],
  ["Kaeleth Var", "Sith Inquisitor", "ic", false, -94.5, -83.2, 52.1, 2],
  ["Ysolde Marr", "Imperial Agent", "ic", true, -96.7, -77.3, 52.1, 0],
  ["Tobin Reyl", "Bounty Hunter", "ic", false, -108.6, -77.9, 52.1, 3],
  ["Nyssara", "Sith Inquisitor", "ooc", false, -104.2, -72.3, 52.1, 6],
  ["Brakk Ordo", "Bounty Hunter", "ic", false, -96.7, -70.4, 52.1, 1],
  ["Ilvana Tesh", "Imperial Agent", "ic", false, -111.1, -81, 52.1, 4],
  // a second scene on the Upper Promenade
  ["Cassian Dray", "Smuggler", "ic", false, -96.5, -89.6, 54.0, 2],
  ["Mira Solanne", "Jedi Consular", "ic", false, -92.2, -81.7, 54.0, 1],
  ["Rook Vendrel", "Trooper", "ooc", false, -91.3, -74.6, 54.0, 9],
  ["Sael Torin", "Jedi Knight", "ic", true, -102.1, -89.6, 54.0, 0],
  ["Quenna Lisk", "Smuggler", "ic", false, -94.6, -85.9, 54.0, 5],
  // the casino crowd
  ["Darth Ashkaar", "Sith Warrior", "ic", false, 52.6, -122.4, 107.2, 1],
  ["Lirael Voss", "Imperial Agent", "ic", false, 56.1, -119.8, 107.2, 2],
  ["Hadrik Sunn", "Bounty Hunter", "ic", false, 49.3, -125.9, 107.2, 0],
  ["Tessaly Mour", "Sith Inquisitor", "ooc", false, 71.8, -137.5, 107.4, 12],
  ["Ozren Kael", "Sith Warrior", "ic", false, 66.4, -134.1, 107.4, 3],
  ["Vessa Nahri", "Imperial Agent", "ic", true, 44.7, -121.1, 107.2, 1],
  // two at the market
  ["Jorren Tal", "Smuggler", "ic", false, -226.2, 332.6, -144.1, 4],
  ["Aeliss Corvane", "Jedi Consular", "ic", false, -228.9, 335.0, -144.1, 4],
  // on their own
  ["Threx", "Bounty Hunter", "ooc", false, -140.5, -30.2, 55.0, 18],
  ["Maevin Crell", "Jedi Knight", "ic", false, 150.3, 290.7, 60.0, 7],
  ["Iskra Dune", "Trooper", "ic", false, -80.6, -160.4, 50.9, 2],
];

const FRIENDS = ["Ysolde Marr", "Cassian Dray"];
// private notes, the kind you would actually write
const NOTES: [string, string][] = [
  ["Ysolde Marr", "Handler for the Nar Shaddaa cell. Owes me 40k credits from the sabacc night."],
  ["Cassian Dray", "Pilot. Knows the Hutt cartel routes, wants a way into the casino job."],
  ["Darth Ashkaar", "Very formal, stays in character even in whispers. Rivalry thread with Vashti."],
  ["Tobin Reyl", "New to the server, looking for a crew. Friendly, plays it straight."],
];

// nearby players the log mentioned but who are not on Hydian
const SEEN: [string, number, number, number][] = [
  ["Kovan", -100.4, -74.8, 52.1],
  ["Ryla Ferris", -107.3, -74.1, 52.1],
  ["Dax Umbrin", -93.2, -77.9, 54.0],
];

const ME = { name: "Talyn Ressk", cls: "Sith Inquisitor", disc: "Sorcerer", x: -1011, y: -804, z: 521 };

const idOf = (name: string) => String(2000 + [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100_000, 7));
const stamp = (msAgo: number) => {
  const d = new Date(Date.now() - msAgo);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.000`;
};

/** `?demo=1&view=registry&modal=settings`: which screen to open, for captures. */
function demoScreen(): Partial<Pick<AppState, "view" | "modal">> {
  const q = new URLSearchParams(location.search);
  const view = q.get("view");
  const modal = q.get("modal");
  const out: Partial<Pick<AppState, "view" | "modal">> = {};
  if (view === "map" || view === "registry" || view === "journal") out.view = view;
  if (modal === "settings" || modal === "characters" || modal === "offboard" || modal === "notice")
    out.modal = { kind: modal };
  else if (modal === "profile") out.modal = { kind: "profile", key: `${SERVER}:${idOf("Ysolde Marr")}` };
  return out;
}

export function demoState() {
  const now = Date.now();
  const livePlayers: Record<string, Player> = {};
  for (const [name, cls, status, lfrp, gx, gy, gz, min] of ROWS) {
    const [x, y, z] = [gx * SCALE, gy * SCALE, gz * SCALE];
    const id = idOf(name);
    const key = `${SERVER}:${id}`;
    livePlayers[key] = {
      key,
      id,
      name,
      server: SERVER,
      cls,
      disc: null,
      planetId: NAR_SHADDAA.id,
      areaName: NAR_SHADDAA.name,
      x,
      y,
      z,
      heading: 0,
      status,
      lfrp,
      instance: null,
      hue: hueOf(id),
      lastActive: now - min * 60_000,
    };
  }
  const friends: Record<string, { name: string; server: string; since: number; fromGame?: boolean; via?: string }> = {};
  for (const n of FRIENDS) friends[`${SERVER}:${idOf(n)}`] = { name: n, server: SERVER, since: now - 30 * 86_400_000 };
  friends[`${SERVER}:${idOf("Ysolde Marr")}`].fromGame = true;
  friends[`${SERVER}:${idOf("Ysolde Marr")}`].via = ME.name;
  const notes: Record<string, PersonNote> = {};
  for (const [n, text] of NOTES) {
    const key = `${SERVER}:${idOf(n)}`;
    notes[key] = { key, name: n, server: SERVER, doc: null, text, updated: now - 3 * 86_400_000 };
  }

  const meId = idOf(ME.name);
  const pos: Position = {
    x: ME.x,
    y: ME.y,
    z: ME.z,
    heading: 1.2,
    hp: 128_400,
    hpMax: 128_400,
    at: stamp(0),
    atMs: now,
  };
  const sightings = new Map(
    SEEN.map(([name, gx, gy, gz]) => {
      const id = idOf(name);
      return [id, { id, name, x: gx * SCALE, y: gy * SCALE, z: gz * SCALE, at: stamp(90_000), atMs: now - 90_000 }];
    }),
  );
  const live: SessionState = {
    ownerId: meId,
    ownerName: ME.name,
    server: SERVER,
    cls: ME.cls,
    disc: ME.disc,
    area: NAR_SHADDAA,
    areaEnteredAt: stamp(25 * 60_000),
    pos,
    sightings,
    lines: 4_812,
    dayBase: new Date().setHours(0, 0, 0, 0),
    startSec: 0,
  };
  const me: CharacterSnapshot = {
    lastEventMs: now,
    id: meId,
    name: ME.name,
    server: SERVER,
    cls: ME.cls,
    disc: ME.disc,
    area: NAR_SHADDAA,
    pos,
    lastSeen: now,
    sessions: 41,
  };
  const activeKey = `${SERVER}:${meId}`;
  return {
    share: false,
    serverUrl: "http://127.0.0.1:9",
    server: SERVER,
    planet: "nar-shaddaa",
    livePlayers,
    friends,
    notes,
    myChars: [me],
    activeKey,
    charStatus: { [activeKey]: { status: "ic" as const, lfrp: false, instance: null } },
    live,
    liveAt: now,
    link: { status: "live" as const, file: "combat_demo.txt", progress: [1, 1] as [number, number], lines: 4_812 },
    showSeen: true,
    legend: true,
    ...demoScreen(),
  };
}

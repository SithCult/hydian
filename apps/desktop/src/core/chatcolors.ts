// Chat colours: SWTOR keeps them per character in `<server>_<Name>_PlayerGUIState.ini`, one line
// `ChatColors = rrggbb;rrggbb;…` indexed by channel. Hydian designs one palette and writes that line only.
import { contrast, distance, hexToLch, isHex, withContrast, type Lch } from "./color";
import { decoder, gameFS, isTauri, join } from "./fs";

export type Family = "talk" | "party" | "guild" | "global" | "custom" | "system";

export interface Channel {
  ix: number; // position in the ChatColors line
  name: string;
  family: Family;
  /** The optimised colour: the game's hue (unless `h` gives one), even lightness (`l` offsets it), intensity `c`. */
  h?: number;
  l: number;
  c: number;
}

export const FAMILIES: { id: Family; name: string }[] = [
  { id: "talk", name: "Conversation" },
  { id: "party", name: "Group and ops" },
  { id: "guild", name: "Guild" },
  { id: "global", name: "Global" },
  { id: "custom", name: "Custom channels" },
  { id: "system", name: "System" },
];

const ch = (ix: number, name: string, family: Family, l = 0, c = 1, h?: number): Channel => ({
  ix,
  name,
  family,
  l,
  c,
  h,
});

// Where the game gives several channels one colour, each gets its own shade of it; the custom channels, all
// yellow in the game, get hues of their own, the first one staying yellow.
export const CHANNELS: Channel[] = [
  ch(0, "Say", "talk", 0.09, 0.3),
  ch(2, "Emote", "talk"),
  ch(1, "Yell", "talk", -0.02, 1.1),
  ch(3, "Whisper", "talk", 0.01),
  ch(9, "Group", "party"),
  ch(12, "Ops", "party", 0.02),
  ch(29, "Ops leader", "party", -0.03, 1.1),
  ch(13, "Ops officer", "party", -0.06, 0.9, 128),
  ch(33, "Ops announcement", "party", -0.07, 1.1),
  ch(10, "Guild", "guild"),
  ch(11, "Officer", "guild", -0.02),
  ch(6, "General", "global", 0.03, 0.55),
  ch(7, "Trade", "global", 0, 0.75, 190),
  ch(8, "PvP", "global", -0.03, 0.75, 240),
  ...[105, 175, 350, 230, 75, 270, 20].map((h, i) =>
    ch(22 + i, `Custom channel ${i + 1}`, "custom", [0.08, -0.05, 0.03, -0.03, 0.05, -0.06, 0.02][i], i ? 1 : 1.3, h),
  ),
  ch(18, "System feedback", "system", -0.06, 0.35),
  ch(19, "Conversation", "system", -0.03, 0.35),
  ch(20, "Character login", "system", -0.09, 0.35),
  ch(35, "Group information", "system", -0.06, 0.6),
  ch(34, "Ops information", "system", -0.08, 0.6),
  ch(36, "Guild information", "system", -0.06, 0.6),
  ch(37, "Combat information", "system", -0.04, 0.7),
  ch(15, "Error", "system", -0.13, 1.7),
  ch(17, "Server admin", "system", 0.02, 0.8),
];

const CHANNEL_COUNT = 38;

/** The game's own colours for a new character. */
export const SWTOR_DEFAULTS =
  "b3ecff;ff7397;ff8022;a59ff3;eeee00;eeee00;b3ecff;b3ecff;b3ecff;1d8cfe;82ec89;ff00ff;efbc55;317a3c;eeee00;ff0000;eeee00;ff7f7f;eeee00;eeee00;eeee00;eeee00;eeee00;eeee00;eeee00;eeee00;eeee00;eeee00;eeee00;ff5400;eeee00;eeee00;eeee00;a00000;c92e56;bb4fd2;1fab29;ff6600".split(
    ";",
  );

/** The chat window is a dark translucent panel; colours are checked against its darkest likely backdrop. */
export const CHAT_BG = "0b0d12";
export const MIN_CONTRAST = 4.5;

// ---------------------------------------------------------------- optimised
function optimised(c: Channel): Lch {
  const h = c.h ?? hexToLch(SWTOR_DEFAULTS[c.ix]).h;
  return { l: 0.8 + c.l, c: 0.12 * c.c, h };
}

/** The game's colours with even lightness and intensity, readable on the chat window and easy to tell apart. */
export function optimisedColors(): string[] {
  const out = [...SWTOR_DEFAULTS];
  const lch = new Map(CHANNELS.map((c) => [c.ix, optimised(c)]));
  lch.forEach((v, ix) => (out[ix] = withContrast(v, CHAT_BG, MIN_CONTRAST)));
  // channels read side by side must not look alike: step lightness apart until they don't
  for (let pass = 0; pass < 6; pass++) {
    const pairs = closePairs(out);
    if (!pairs.length) break;
    for (const [, move] of pairs) {
      // lighter or darker, whichever leaves it furthest from every channel it is read next to
      const v = lch.get(move.ix)!;
      const nearest = (l: number) => {
        const hex = withContrast({ ...v, l }, CHAT_BG, MIN_CONTRAST);
        return Math.min(...READ_TOGETHER.filter((c) => c !== move).map((c) => distance(hex, out[c.ix])));
      };
      const [up, down] = [Math.min(0.95, v.l + 0.05), Math.max(0.55, v.l - 0.05)];
      lch.set(move.ix, { ...v, l: nearest(up) >= nearest(down) ? up : down });
      out[move.ix] = withContrast(lch.get(move.ix)!, CHAT_BG, MIN_CONTRAST);
    }
  }
  return out;
}

/** The channels that share a chat tab in play and have to be told apart at a glance. */
const READ_TOGETHER = [
  "Say",
  "Emote",
  "Yell",
  "Whisper",
  "Group",
  "Ops",
  "Guild",
  "Officer",
  "General",
  "Custom channel 1",
  "Custom channel 2",
  "Custom channel 3",
].map((n) => CHANNELS.find((c) => c.name === n)!);

/** Pairs of those channels that are hard to tell apart (OKLab distance under about two noticeable steps). */
export function closePairs(colors: string[]): [Channel, Channel][] {
  const out: [Channel, Channel][] = [];
  for (let i = 0; i < READ_TOGETHER.length; i++)
    for (let j = i + 1; j < READ_TOGETHER.length; j++) {
      const [a, b] = [READ_TOGETHER[i], READ_TOGETHER[j]];
      if (a.family === b.family && (a.family === "party" || a.family === "guild")) continue; // siblings may be close
      if (distance(colors[a.ix], colors[b.ix]) < 0.045) out.push([a, b]);
    }
  return out;
}

export const lowContrast = (colors: string[]) => CHANNELS.filter((c) => contrast(colors[c.ix], CHAT_BG) < MIN_CONTRAST);

// ---------------------------------------------------------------- files
export interface CharacterFile {
  server: string;
  name: string;
  file: string; // full path
  colors: string[] | null; // null: the file has no ChatColors line yet
}

const FILE_RE = /^(he\d+)_(.+)_PlayerGUIState\.ini$/i;

function parseChatColors(text: string): string[] | null {
  const line = text.split(/\r?\n/).find((l) => /^\s*ChatColors\s*=/i.test(l));
  if (!line) return null;
  const values = line
    .slice(line.indexOf("=") + 1)
    .trim()
    .split(";");
  return Array.from({ length: CHANNEL_COUNT }, (_, i) =>
    isHex(values[i]?.trim() ?? "") ? values[i].trim().toLowerCase() : SWTOR_DEFAULTS[i],
  );
}

export async function readCharacters(settingsDir: string): Promise<CharacterFile[]> {
  const fs = await gameFS();
  const entries = await fs.readDir(settingsDir, /^$/);
  const files = entries.filter((e) => !e.isDir && FILE_RE.test(e.name));
  return Promise.all(
    files.map(async (e) => {
      const [, server, name] = FILE_RE.exec(e.name)!;
      const file = join(settingsDir, e.name);
      let colors: string[] | null = null;
      try {
        const st = await fs.stat(file);
        colors = parseChatColors(decoder.decode(await fs.read(file, 0, Math.min(st.size, 512 * 1024))));
      } catch {
        /* unreadable: listed without colours */
      }
      return { server, name, file, colors };
    }),
  );
}

export const canWrite = isTauri;

/** Writes the ChatColors line of one character file. The first write keeps a copy of the file's original colours. */
export async function writeColors(file: string, colors: string[]): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("chat_colors_write", { path: file, colors });
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    throw new Error(message, { cause: error });
  }
}

/** The colours a file had before Hydian first changed them, if it ever did. */
export async function originalColors(file: string): Promise<string[] | null> {
  if (!isTauri()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  const line = await invoke<string | null>("chat_colors_original", { path: file }).catch(() => null);
  return line === null ? null : parseChatColors(`ChatColors = ${line}`);
}

export async function isGameRunning(): Promise<boolean | null> {
  if (!isTauri()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean | null>("is_game_running").catch(() => null);
}

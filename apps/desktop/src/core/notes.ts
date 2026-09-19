// Private notes about people and the RP journal. Rich documents (BlockNote blocks) in IndexedDB, plain-text
// shadows for search and previews. Local only: never uploaded, never shown to anyone else.
import { dbDel, dbGet, dbList, dbSet } from "./db";
import { gameFS, decoder, join } from "./fs";

export type Blocks = unknown[]; // BlockNote document JSON; the editor owns the shape

export interface PersonNote {
  key: string; // server:id, or server:@Name until an id is known
  name: string;
  server: string;
  doc: Blocks | null; // null = only imported text so far (turned into blocks on first edit)
  text: string; // plain text (search, previews)
  updated: number;
  imported?: { from: string; at: number; text: string }; // the in-game note it started from
}

export interface JournalEntry {
  id: string;
  title: string;
  at: number; // when it happened (epoch ms)
  updated: number;
  doc: Blocks | null;
  text: string;
  planetId: string | null;
  where: string | null;
  people: { key: string; name: string; server: string }[];
  tags: string[];
}

const NOTE = "note:",
  ENTRY = "journal:";
export const noteKeyByName = (server: string, name: string) => `${server}:@${name.toLowerCase()}`;

// ---------------------------------------------------------------- notes
export const loadNotes = async () =>
  Object.fromEntries((await dbList<PersonNote>(NOTE)).map(([k, v]) => [k.slice(NOTE.length), v])) as Record<
    string,
    PersonNote
  >;
export const saveNote = (n: PersonNote) => dbSet(NOTE + n.key, n);
export const deleteNote = (key: string) => dbDel(NOTE + key);
export const getNote = (key: string) => dbGet<PersonNote>(NOTE + key);

/** Plain text of a BlockNote document (best effort, for search/previews). */
export function blocksToText(doc: Blocks | null | undefined): string {
  if (!doc) return "";
  const out: string[] = [];
  const walk = (b: unknown) => {
    if (!b || typeof b !== "object") return;
    const o = b as { content?: unknown; children?: unknown[] };
    if (Array.isArray(o.content))
      for (const c of o.content) {
        const t = (c as { text?: string }).text;
        if (t) out.push(t);
      }
    else if (typeof o.content === "string") out.push(o.content);
    if (Array.isArray(o.children)) o.children.forEach(walk);
    out.push("\n");
  };
  (doc as unknown[]).forEach(walk);
  return out
    .join("")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
/** The first line of a note, as plain text, for a table cell. */
export function notePreview(n: PersonNote | undefined, max = 90): string {
  if (!n) return "";
  const text = (n.text || blocksToText(n.doc)).replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}
/** Paragraph blocks from plain text: how imported in-game notes become editable documents. */
export const textToBlocks = (text: string): Blocks =>
  text
    .split(/\r?\n/)
    .map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line, styles: {} }] : [] }));

// ---------------------------------------------------------------- in-game notes (LocalSocialSettings.ini)
/**
 * SWTOR keeps the friends-list comments per own character in
 * <settings>/<server>_<Character>_LocalSocialSettings.ini, section [Comments], `Name = text` with
 * `<<<SI-END-OF-MULTILINE-TEXT … SI-END-OF-MULTILINE-TEXT` for multi-line notes. Read-only, like everything else.
 */
export interface GameNote {
  server: string;
  owner: string;
  name: string;
  text: string;
}
export async function readGameNotes(settingsDir: string): Promise<GameNote[]> {
  const fs = await gameFS();
  const files = (await fs.readDir(settingsDir, /^$/)).filter(
    (e) => !e.isDir && /_LocalSocialSettings\.ini$/i.test(e.name),
  );
  const out: GameNote[] = [];
  for (const f of files) {
    const m = /^(he\d{4})_(.+)_LocalSocialSettings\.ini$/i.exec(f.name);
    if (!m) continue;
    const [, server, owner] = m;
    try {
      const st = await fs.stat(join(settingsDir, f.name));
      const bytes = await fs.read(join(settingsDir, f.name), 0, Math.min(st.size, 2 * 1024 * 1024));
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        text = decoder.decode(bytes);
      }
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
      const lines = text.split(/\r?\n/);
      let inComments = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\[/.test(line)) {
          inComments = /^\[Comments\]/i.test(line);
          continue;
        }
        if (!inComments) continue;
        const eq = line.indexOf(" = ");
        if (eq < 0) continue;
        const name = line.slice(0, eq).trim();
        let value = line.slice(eq + 3);
        if (value.startsWith("<<<SI-END-OF-MULTILINE-TEXT")) {
          const buf: string[] = [];
          for (i++; i < lines.length && lines[i] !== "SI-END-OF-MULTILINE-TEXT"; i++) buf.push(lines[i]);
          value = buf.join("\n").trim();
        }
        if (name && value.trim()) out.push({ server, owner, name, text: value.trim() });
      }
    } catch {
      /* unreadable file: skip */
    }
  }
  return out;
}

// ---------------------------------------------------------------- journal
export const loadJournal = async () =>
  (await dbList<JournalEntry>(ENTRY)).map(([, v]) => v).sort((a, b) => b.at - a.at);
export const saveEntry = (e: JournalEntry) => dbSet(ENTRY + e.id, e);
export const deleteEntry = (id: string) => dbDel(ENTRY + id);
export const newEntryId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

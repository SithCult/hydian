import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Palette, RotateCcw, TriangleAlert } from "lucide-react";
import { useApp } from "../../store";
import { SERVER_NAMES } from "../../core/gamelink";
import {
  CHANNELS,
  FAMILIES,
  SWTOR_DEFAULTS,
  canWrite,
  closePairs,
  isGameRunning,
  lowContrast,
  optimisedColors,
  originalColors,
  readCharacters,
  writeColors,
  type CharacterFile,
} from "../../core/chatcolors";
import { ChatPreview } from "./ChatPreview";
import { Tip } from "../Tip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Choice = "default" | "optimised" | "character" | "custom";
interface Saved {
  choice: Choice;
  source: { name: string; server: string; colors: string[] } | null; // the character to copy from
  /** Single colours changed by hand, on top of the colours that were selected at the time (`from`). */
  custom: { colors: string[]; from: string[]; fromName: string } | null;
}

const STORE = "hydian:chatColors";
const load = (): Saved => {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null") as Saved | null;
    if (v && ["default", "optimised", "character", "custom"].includes(v.choice))
      return { ...v, custom: v.custom ?? null };
  } catch {
    /* ignore */
  }
  return { choice: "optimised", source: null, custom: null };
};

const OPTIMISED = optimisedColors();
const byName = (n: string) => CHANNELS.find((c) => c.name === n)!.ix;
const STRIP = ["Say", "Emote", "Yell", "Whisper", "Group", "Guild", "General", "Custom channel 1"].map(byName);
const plural = (n: number) => `${n} character${n === 1 ? "" : "s"}`;
const sameColors = (a: string[] | null, b: string[]) =>
  !!a && CHANNELS.every((c) => a[c.ix]?.toLowerCase() === b[c.ix].toLowerCase());

function Strip({ colors }: { colors: string[] }) {
  return (
    <span className="cc-strip" aria-hidden="true">
      {STRIP.map((ix) => (
        <i key={ix} style={{ background: `#${colors[ix]}` }} />
      ))}
    </span>
  );
}

export function ChatColors() {
  const [saved, setSaved] = useState<Saved>(load);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }, [saved]);
  const chars = useCharacters();
  const names = useMemo(() => [...new Set((chars.list ?? []).map((c) => c.name))].slice(0, 7), [chars.list]);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(saved.choice === "custom");

  const colors =
    saved.choice === "custom" && saved.custom
      ? saved.custom.colors
      : saved.choice === "default"
        ? SWTOR_DEFAULTS
        : saved.choice === "character" && saved.source
          ? saved.source.colors
          : OPTIMISED;
  const choiceName =
    saved.choice === "default"
      ? "SWTOR default"
      : saved.choice === "character"
        ? `${saved.source?.name}'s colours`
        : "Optimised";
  // the first change starts your own colours from whatever is selected; later changes build on them
  const setColor = (ix: number, hex: string) => {
    const custom =
      saved.choice === "custom" && saved.custom
        ? saved.custom
        : { colors: [...colors], from: [...colors], fromName: choiceName };
    const next = [...custom.colors];
    next[ix] = hex;
    setSaved({ ...saved, choice: "custom", custom: { ...custom, colors: next } });
  };
  const issues = [
    ...lowContrast(colors).map((c) => `${c.name} is hard to read`),
    ...closePairs(colors).map(([a, b]) => `${a.name} and ${b.name} look alike`),
  ];
  const withColors = (chars.list ?? []).filter((c) => c.colors);

  return (
    <div className="cc scroll">
      <div className="cc-page">
        <section className="cc-choices" role="radiogroup" aria-label="Colours">
          <Option
            on={saved.choice === "optimised"}
            name="Optimised"
            hint="The game's colours, balanced so every channel is easy to read and tell apart"
            colors={OPTIMISED}
            onClick={() => setSaved({ ...saved, choice: "optimised" })}
          />
          <Option
            on={saved.choice === "default"}
            name="SWTOR default"
            hint="The colours the game gives a new character"
            colors={SWTOR_DEFAULTS}
            onClick={() => setSaved({ ...saved, choice: "default" })}
          />
          <Popover open={picking} onOpenChange={setPicking}>
            <PopoverTrigger asChild>
              <button
                className={`cc-option ${saved.choice === "character" ? "on" : ""}`}
                role="radio"
                aria-checked={saved.choice === "character"}
                disabled={!withColors.length}
              >
                <OptionBody
                  name={saved.source ? `${saved.source.name}'s colours` : "Copy a character"}
                  hint={
                    saved.source
                      ? `${SERVER_NAMES[saved.source.server] ?? saved.source.server}. Click to pick another character`
                      : "Give your other characters the colours one of them already has"
                  }
                  colors={saved.source?.colors ?? null}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="cc-pop w-[320px]">
              <div className="cc-pop-title">Copy the colours of</div>
              <CharacterList
                chars={withColors}
                render={(c) => (
                  <button
                    className="cc-char"
                    onClick={() => {
                      setSaved({
                        ...saved,
                        choice: "character",
                        source: { name: c.name, server: c.server, colors: c.colors! },
                      });
                      setPicking(false);
                    }}
                  >
                    <span className="nm">{c.name}</span>
                    <Strip colors={c.colors!} />
                  </button>
                )}
              />
            </PopoverContent>
          </Popover>
          {saved.custom && (
            <Option
              on={saved.choice === "custom"}
              name="Your colours"
              hint={`Your changes to ${saved.custom.fromName}`}
              colors={saved.custom.colors}
              onClick={() => setSaved({ ...saved, choice: "custom" })}
            />
          )}
          {editing ? (
            <ChannelEditor
              colors={colors}
              from={saved.choice === "custom" ? saved.custom?.from : undefined}
              onChange={setColor}
              onClose={() => setEditing(false)}
            />
          ) : (
            <button className="cc-edit-open" onClick={() => setEditing(true)}>
              <Palette size={15} aria-hidden="true" /> Change single colours
            </button>
          )}
        </section>
        <ChatPreview colors={colors} names={names} badge={<Readability issues={issues} />} />
      </div>
      <ApplyBar colors={colors} chars={chars} />
    </div>
  );
}

function Option({
  on,
  onClick,
  ...body
}: {
  on: boolean;
  name: string;
  hint: string;
  colors: string[];
  onClick: () => void;
}) {
  return (
    <button className={`cc-option ${on ? "on" : ""}`} role="radio" aria-checked={on} onClick={onClick}>
      <OptionBody {...body} />
    </button>
  );
}

function OptionBody({ name, hint, colors }: { name: string; hint: string; colors: string[] | null }) {
  return (
    <>
      <span className="radio" aria-hidden="true" />
      <span className="txt">
        <b>{name}</b>
        <span>{hint}</span>
      </span>
      {colors ? <Strip colors={colors} /> : <ChevronDown size={16} className="cc-more" aria-hidden="true" />}
    </>
  );
}

function ChannelEditor({
  colors,
  from,
  onChange,
  onClose,
}: {
  colors: string[];
  from?: string[];
  onChange: (ix: number, hex: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="cc-editor">
      <div className="cc-editor-head">
        <b>Single colours</b>
        <button onClick={onClose}>Done</button>
      </div>
      {FAMILIES.map((f) => (
        <div key={f.id} className="cc-editor-group">
          <div className="cc-editor-family">{f.name}</div>
          <div className="cc-editor-rows">
            {CHANNELS.filter((c) => c.family === f.id).map((c) => {
              const changed = !!from && from[c.ix] !== colors[c.ix];
              return (
                <div key={c.ix} className="cc-editor-row">
                  <label className="cc-swatch" style={{ background: `#${colors[c.ix]}` }}>
                    <input
                      type="color"
                      value={`#${colors[c.ix]}`}
                      aria-label={`${c.name} colour`}
                      onChange={(e) => onChange(c.ix, e.target.value.slice(1).toLowerCase())}
                    />
                  </label>
                  <span className="nm">{c.name}</span>
                  {changed && (
                    <Tip label="Undo this change">
                      <button
                        className="cc-reset"
                        aria-label={`Undo the change to ${c.name}`}
                        onClick={() => onChange(c.ix, from![c.ix])}
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                      </button>
                    </Tip>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Readability({ issues }: { issues: string[] }) {
  if (!issues.length)
    return (
      <span className="cc-read ok">
        <Check size={14} aria-hidden="true" /> Every channel is easy to read
      </span>
    );
  return (
    <Tip label={issues.slice(0, 4).join(". ")}>
      <span className="cc-read warn">
        <TriangleAlert size={14} aria-hidden="true" />
        {issues.length === 1 ? issues[0] : "Some channels are hard to read or tell apart"}
      </span>
    </Tip>
  );
}

// ---------------------------------------------------------------- characters
interface Characters {
  list: CharacterFile[] | null;
  error: string | null;
  reload: () => Promise<void>;
}

function useCharacters(): Characters {
  const settingsDir = useApp((s) => s.paths?.settingsDir);
  const [list, setList] = useState<CharacterFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!settingsDir) return;
    try {
      const found = await readCharacters(settingsDir);
      setList(found.sort((a, b) => a.server.localeCompare(b.server) || a.name.localeCompare(b.name)));
      setError(null);
    } catch {
      setList([]);
      setError("Hydian couldn't read the game's settings folder.");
    }
  }, [settingsDir]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { list, error, reload };
}

function CharacterList({ chars, render }: { chars: CharacterFile[]; render: (c: CharacterFile) => ReactNode }) {
  const [q, setQ] = useState("");
  const shown = chars.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const groups = Object.entries(
    shown.reduce<Record<string, CharacterFile[]>>((acc, c) => ((acc[c.server] ??= []).push(c), acc), {}),
  );
  return (
    <>
      {chars.length > 8 && (
        <input className="cc-find" placeholder="Find a character" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      <div className="cc-chars scroll">
        {groups.map(([server, cs]) => (
          <div key={server}>
            <div className="cc-server">{SERVER_NAMES[server] ?? server}</div>
            {cs.map((c) => (
              <div key={c.file}>{render(c)}</div>
            ))}
          </div>
        ))}
        {!shown.length && <p className="cc-hint">No character by that name.</p>}
      </div>
    </>
  );
}

/** Whether SWTOR is running: asked once, then kept current by the app's `game` event. */
function useGameRunning(): boolean | null {
  const [running, setRunning] = useState<boolean | null>(null);
  useEffect(() => {
    let stop: (() => void) | null = null;
    let disposed = false;
    void isGameRunning().then((v) => !disposed && setRunning(v));
    if (canWrite())
      void import("@tauri-apps/api/event").then(({ listen }) =>
        listen<{ running: boolean | null }>("game", (e) => setRunning(e.payload.running)).then((un) =>
          disposed ? un() : (stop = un),
        ),
      );
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
  return running;
}

function ApplyBar({ colors, chars }: { colors: string[]; chars: Characters }) {
  const live = useApp((s) => (s.link.status === "live" ? s.live : null));
  const toast = useApp((s) => s.toast);
  const list = chars.list ?? [];
  const current = list.find(
    (c) => live?.server === c.server && live?.ownerName?.toLowerCase() === c.name.toLowerCase(),
  );
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const gameUp = useGameRunning();
  // until the user picks, the last played character is the target, or everyone when there is none
  const selected = picked ?? new Set(current ? [current.file] : list.map((c) => c.file));
  const targets = list.filter((c) => selected.has(c.file));

  const run = async (what: "apply" | "restore") => {
    setBusy(true);
    let done = 0;
    const failed: string[] = [];
    for (const c of targets) {
      try {
        const next = what === "apply" ? colors : await originalColors(c.file);
        if (!next) continue;
        // only the chat channels; the game's unused slots stay as they are
        await writeColors(
          c.file,
          next.map((hex, ix) => (CHANNELS.some((ch) => ch.ix === ix) ? hex : "")),
        );
        done++;
      } catch {
        failed.push(c.name);
      }
    }
    await chars.reload();
    setBusy(false);
    if (failed.length) toast(`Couldn't change ${failed.join(", ")}. The file may be read-only.`, "warn");
    else if (what === "restore")
      toast(
        done ? `Put back the earlier colours of ${plural(done)}.` : "Hydian hasn't changed these characters.",
        done ? "ok" : "info",
      );
    else toast(`Done. ${plural(done)} get these colours the next time you start SWTOR.`, "ok");
  };

  const label =
    targets.length === 1
      ? targets[0].name
      : targets.length === list.length && list.length
        ? `All ${plural(list.length)}`
        : plural(targets.length);
  const inSync = targets.length > 0 && targets.every((c) => sameColors(c.colors, colors));
  // the running game keeps chat colours in memory and saves them over the file, so it has to be closed
  const blocked = !canWrite() || busy || !targets.length || gameUp === true;

  return (
    <div className="cc-bar">
      <div className="cc-bar-in">
        <span className="cc-bar-label">Apply to</span>
        <Popover>
          <PopoverTrigger asChild>
            <button className="cc-target" disabled={!list.length}>
              {label}
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="cc-pop w-[320px]">
            <div className="cc-pop-head">
              <span className="cc-pop-title">Characters</span>
              {current && <button onClick={() => setPicked(new Set([current.file]))}>Last played</button>}
              <button onClick={() => setPicked(new Set(list.map((c) => c.file)))}>All</button>
              <button onClick={() => setPicked(new Set())}>None</button>
            </div>
            <CharacterList
              chars={list}
              render={(c) => (
                <label className="cc-char">
                  <input
                    type="checkbox"
                    checked={selected.has(c.file)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(c.file)) next.delete(c.file);
                      else next.add(c.file);
                      setPicked(next);
                    }}
                  />
                  <span className="nm">{c.name}</span>
                  {c === current && <span className="cc-live">Last played</span>}
                  {sameColors(c.colors, colors) && (
                    <Tip label="Already has these colours">
                      <Check size={14} className="cc-sync" />
                    </Tip>
                  )}
                </label>
              )}
            />
          </PopoverContent>
        </Popover>
        <span className="cc-bar-note">
          {chars.error ??
            (!canWrite()
              ? "Applying works in the desktop app."
              : gameUp
                ? "Close SWTOR first. The running game keeps its own colours and saves them over these."
                : inSync
                  ? "Already applied."
                  : "Shows the next time you start SWTOR.")}
        </span>
        <Tip label="Put back the colours these characters had before Hydian changed them">
          <Button variant="ghost" size="sm" disabled={blocked} onClick={() => void run("restore")}>
            <RotateCcw size={14} aria-hidden="true" /> Undo
          </Button>
        </Tip>
        <Button disabled={blocked || inSync} onClick={() => void run("apply")}>
          Apply
        </Button>
      </div>
    </div>
  );
}

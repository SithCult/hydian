import { useEffect, useMemo, useRef, useState } from "react";
import { planetById } from "../data/planets";
import { locate } from "../data/maps";
import { SERVER_NAMES } from "../core/gamelink";
import { newEntryId, type JournalEntry } from "../core/notes";
import { useApp } from "../store";
import { selectMe } from "../selectors";
import { Editor } from "./Editor";
import { Avatar, EditorHelp, Icons, PlanetIcon, Private } from "./bits";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { hueOf } from "../model";
import { Tip } from "./Tip";
import { Button } from "@/components/ui/button";

/**
 * RP journal: entries with a date, a place, the people who were there and a rich body. Everything local.
 * Left: the timeline grouped by month, searchable. Right: the entry. New entries start with where you are
 * and who is around, so a scene can be written up in one go.
 */
export function Journal() {
  const journal = useApp((s) => s.journal);
  const putEntry = useApp((s) => s.putEntry);
  const removeEntry = useApp((s) => s.removeEntry);
  const [ask, setAsk] = useState(false); // delete confirmation for an entry with content
  const search = useApp((s) => s.search)
    .trim()
    .toLowerCase();
  const focus = useApp((s) => s.journalFocus);
  const [sel, setSel] = useState<string | null>(focus ?? journal[0]?.id ?? null);
  useEffect(() => {
    if (focus) {
      setSel(focus);
      useApp.setState({ journalFocus: null });
    }
  }, [focus]);
  const entry = journal.find((e) => e.id === sel) ?? null;

  const list = useMemo(
    () =>
      journal.filter(
        (e) =>
          !search ||
          e.title.toLowerCase().includes(search) ||
          e.text.toLowerCase().includes(search) ||
          e.people.some((p) => p.name.toLowerCase().includes(search)) ||
          (e.where ?? "").toLowerCase().includes(search),
      ),
    [journal, search],
  );
  const groups = useMemo(() => {
    const g = new Map<string, JournalEntry[]>();
    for (const e of list) {
      const k = new Date(e.at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      (g.get(k) ?? g.set(k, []).get(k)!).push(e);
    }
    return [...g.entries()];
  }, [list]);

  const create = () => {
    const s = useApp.getState();
    const me = selectMe(s);
    const planet = me?.planetId ? planetById(me.planetId) : undefined;
    const loc = me && me.z ? locate(me.planetId, me.x, me.y, me.z) : null;
    const nearby = me
      ? Object.values(s.livePlayers)
          .filter((p) => p.server === me.server && p.planetId === me.planetId && p.key !== me.key)
          .slice(0, 8)
      : [];
    const e: JournalEntry = {
      id: newEntryId(),
      title: "",
      at: Date.now(),
      updated: Date.now(),
      doc: null,
      text: "",
      planetId: planet?.id ?? null,
      where: loc ? loc.path.join(" › ") : (planet?.name ?? null),
      people: nearby.map((p) => ({ key: p.key, name: p.name, server: p.server })),
      tags: [],
    };
    void putEntry(e);
    setSel(e.id);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        create();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="journal">
      <aside className="jr-list">
        <div className="jr-list-head">
          <b>Journal</b>
          <span>
            {journal.length} {journal.length === 1 ? "entry" : "entries"}
          </span>
          <Tip label="New entry" kbd="Ctrl+N">
            <Button size="sm" onClick={create}>
              + New
            </Button>
          </Tip>
        </div>
        <div className="jr-private">
          <Private what="Your journal" />
        </div>
        <div className="scroll jr-scroll">
          {groups.length === 0 && (
            <div className="jr-empty">
              {search ? (
                "Nothing matches."
              ) : (
                <>
                  Nothing written yet.
                  <br />
                  Start an entry after a scene; it opens with where you are and who was there.
                </>
              )}
            </div>
          )}
          {groups.map(([month, items]) => (
            <div key={month}>
              <div className="jr-month">{month}</div>
              {items.map((e) => {
                const planet = e.planetId ? planetById(e.planetId) : undefined;
                return (
                  <button key={e.id} className={`jr-card ${e.id === sel ? "on" : ""}`} onClick={() => setSel(e.id)}>
                    <div className="jr-card-top">
                      <span className="jr-date">
                        {new Date(e.at).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                      </span>
                      {planet && (
                        <span className="jr-where">
                          <PlanetIcon slug={planet.slug} size={14} faction={planet.faction} />
                          {e.where ?? planet.name}
                        </span>
                      )}
                    </div>
                    <div className="jr-title">{e.title || <em>Untitled</em>}</div>
                    {e.text && <div className="jr-preview">{e.text.slice(0, 140)}</div>}
                    {e.people.length > 0 && (
                      <div className="jr-people">
                        {e.people.slice(0, 5).map((p) => (
                          <Avatar key={p.key} p={{ name: p.name, hue: hueOf(p.key.split(":")[1] ?? "0") }} size="sm" />
                        ))}
                        {e.people.length > 5 && <span className="more">+{e.people.length - 5}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>
      <AlertDialog open={ask} onOpenChange={setAsk}>
        <AlertDialogContent className="jr-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{entry?.title || "Untitled"}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The entry is removed from this device. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="secondary">Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (entry) void removeEntry(entry.id);
                setSel(null);
              }}
            >
              Delete entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <section className="jr-main">
        {entry ? (
          <EntryEditor
            key={entry.id}
            entry={entry}
            onChange={(e) => void putEntry(e)}
            onDelete={() => {
              const empty = !entry.title.trim() && !entry.text.trim();
              if (empty) {
                void removeEntry(entry.id);
                setSel(null);
              } else setAsk(true);
            }}
          />
        ) : (
          <div className="jr-blank">
            <div>
              <b>Your RP journal</b>
              <p>
                Scenes, arcs, who said what. Press <kbd>Ctrl</kbd>+<kbd>N</kbd> or <em>New</em> to write the first
                entry; it opens with where you are and who is around.
              </p>
              <Private what="Your journal" />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EntryEditor({
  entry,
  onChange,
  onDelete,
}: {
  entry: JournalEntry;
  onChange: (e: JournalEntry) => void;
  onDelete: () => void;
}) {
  const [e, setE] = useState(entry);
  const eRef = useRef(e);
  eRef.current = e;
  const update = (patch: Partial<JournalEntry>) => {
    const n = { ...eRef.current, ...patch, updated: Date.now() };
    setE(n);
    onChange(n);
  };
  const planet = e.planetId ? planetById(e.planetId) : undefined;
  const me = useApp(selectMe);
  const useHere = () => {
    const p = me?.planetId ? planetById(me.planetId) : undefined;
    const loc = me && me.z ? locate(me.planetId, me.x, me.y, me.z) : null;
    update({ planetId: p?.id ?? null, where: loc ? loc.path.join(" › ") : (p?.name ?? null) });
  };
  const dateVal = new Date(e.at - new Date(e.at).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return (
    <div className="jr-entry">
      <div className="jr-entry-head">
        <input
          className="jr-title-input"
          value={e.title}
          placeholder="Give the scene a name…"
          onChange={(ev) => update({ title: ev.target.value })}
          autoFocus={!e.title}
        />
        <div className="jr-meta">
          <label className="jr-chip">
            {Icons.clock()}
            <input
              type="datetime-local"
              value={dateVal}
              onChange={(ev) => {
                const t = new Date(ev.target.value).getTime();
                if (!Number.isNaN(t)) update({ at: t });
              }}
            />
          </label>
          <div className="jr-chip">
            {planet ? (
              <PlanetIcon slug={planet.slug} size={16} faction={planet.faction} />
            ) : (
              Icons.map({ width: 14, height: 14 })
            )}
            <input
              value={e.where ?? ""}
              placeholder="Where…"
              onChange={(ev) => update({ where: ev.target.value || null })}
            />
            {me && (
              <Tip label="Use my current location">
                <button className="jr-mini" onClick={useHere}>
                  here
                </button>
              </Tip>
            )}
          </div>
          <PeoplePicker people={e.people} onChange={(people) => update({ people })} />
          <span style={{ flex: 1 }} />
          <EditorHelp />
          <Tip label="Delete entry">
            <Button variant="ghost" size="icon-sm" onClick={onDelete}>
              {Icons.trash()}
            </Button>
          </Tip>
        </div>
      </div>
      <div className="jr-body scroll">
        <Editor
          doc={e.doc}
          placeholder="What happened? Type '/' for headings, lists, quotes…"
          onChange={(doc, text) => update({ doc, text })}
        />
      </div>
      <div className="jr-foot">
        {e.text ? `${e.text.split(/\s+/).filter(Boolean).length} words · ` : ""}saved{" "}
        {new Date(e.updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

/** Who was there: pick from friends, people you have met, and everyone currently on Hydian; or type a name. */
function PeoplePicker({
  people,
  onChange,
}: {
  people: JournalEntry["people"];
  onChange: (p: JournalEntry["people"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const friends = useApp((s) => s.friends);
  const met = useApp((s) => s.met);
  const live = useApp((s) => s.livePlayers);
  const server = useApp((s) => s.server);
  const options = useMemo(() => {
    const m = new Map<string, { key: string; name: string; server: string; friend: boolean }>();
    for (const [k, f] of Object.entries(friends)) m.set(k, { key: k, name: f.name, server: f.server, friend: true });
    for (const p of Object.values(live))
      if (!m.has(p.key)) m.set(p.key, { key: p.key, name: p.name, server: p.server, friend: false });
    for (const [k, e] of Object.entries(met))
      if (!m.has(k)) m.set(k, { key: k, name: e.name, server: e.server, friend: false });
    const ql = q.toLowerCase();
    return [...m.values()]
      .filter((o) => !people.some((p) => p.key === o.key) && (!ql || o.name.toLowerCase().includes(ql)))
      .sort(
        (a, b) =>
          Number(b.friend) - Number(a.friend) ||
          Number(b.server === server) - Number(a.server === server) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 12);
  }, [friends, met, live, people, q, server]);
  const add = (o: { key: string; name: string; server: string }) => {
    onChange([...people, { key: o.key, name: o.name, server: o.server }]);
    setQ("");
  };
  return (
    <div className="jr-people-pick">
      {people.map((p) => (
        <span key={p.key} className="jr-person">
          <Avatar p={{ name: p.name, hue: hueOf(p.key.split(":")[1] ?? "0") }} size="sm" />
          {p.name}
          <Tip label="Remove">
            <button onClick={() => onChange(people.filter((x) => x.key !== p.key))}>×</button>
          </Tip>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="jr-mini add">+ who was there</button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="pop jr-pop w-[280px]">
          <input
            autoFocus
            placeholder="Type a name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) {
                const o = options[0];
                if (o) add(o);
                else add({ key: `${server}:@${q.trim().toLowerCase()}`, name: q.trim(), server });
              }
            }}
          />
          {options.map((o) => (
            <button key={o.key} className="item" onClick={() => add(o)}>
              <Avatar p={{ name: o.name, hue: hueOf(o.key.split(":")[1] ?? "0") }} size="sm" />
              <div>
                <div className="l">
                  {o.name}
                  {o.friend && <span className="friend-tag">friend</span>}
                </div>
                <div className="h">{SERVER_NAMES[o.server] ?? o.server}</div>
              </div>
            </button>
          ))}
          {q.trim() && !options.some((o) => o.name.toLowerCase() === q.trim().toLowerCase()) && (
            <button
              className="item"
              onClick={() => add({ key: `${server}:@${q.trim().toLowerCase()}`, name: q.trim(), server })}
            >
              <span style={{ width: 24 }} />
              <div className="l">Add “{q.trim()}”</div>
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

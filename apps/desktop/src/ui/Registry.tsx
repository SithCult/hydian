import { useEffect, useMemo, useState } from "react";
import { PLANETS, planetById, planetForArea } from "../data/planets";
import { noteKeyByName, notePreview } from "../core/notes";
import { locate } from "../data/maps";
import { SERVER_NAMES } from "../core/gamelink";
import { STATUS_META, LFRP_COLOR, hueOf, presenceOf, type Player, type RPStatus } from "../model";
import { useApp } from "../store";
import { selectLive, selectMe } from "../selectors";
import { Avatar, Icons, PlaceIcon, ago } from "./bits";
import { fetchActivity, toLocal, type Activity } from "../core/activity";
import { Tip } from "./Tip";
import { Button } from "@/components/ui/button";
import { placeLabel } from "../data/places";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Weekday x hour strip: when people on this server are In Character. */
function ActivityPanel({ server }: { server: string }) {
  const serverUrl = useApp((s) => s.serverUrl);
  const [a, setA] = useState<Activity | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    setA(null);
    setErr(false);
    if (!serverUrl) return;
    fetchActivity(serverUrl, server)
      .then((x) => {
        if (live) setA(x);
      })
      .catch(() => {
        if (live) setErr(true);
      });
    return () => {
      live = false;
    };
  }, [server, serverUrl]);
  const grid = a?.grid ? toLocal(a.grid) : null;
  const max = grid ? Math.max(1, ...grid.flat()) : 1;
  const now = new Date();
  return (
    <div className="activity">
      <div className="act-head">
        <b>When roleplay happens here</b>
        <span>
          {err
            ? "server unreachable"
            : !a
              ? "loading…"
              : grid
                ? `last ${a.days} days · your local time`
                : "appears once enough people have been In Character on this server"}
        </span>
      </div>
      {grid && (
        <div className="act-grid">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="act-h">
              {h % 6 === 0 ? `${h}h` : ""}
            </span>
          ))}
          {grid.map((row, d) => (
            <span key={`r${d}`} style={{ display: "contents" }}>
              <span className="act-d">{DAYS[d]}</span>
              {row.map((v, h) => (
                <Tip key={h} label={`${DAYS[d]} ${h}:00 · ${v} character-day${v === 1 ? "" : "s"} In Character`}>
                  <i
                    className={(now.getDay() + 6) % 7 === d && now.getHours() === h ? "now" : ""}
                    style={{ opacity: v ? 0.18 + 0.82 * (v / max) : 0.06 }}
                  />
                </Tip>
              ))}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type Tab = "online" | "all" | "mine" | "seen" | "friends";
type SortKey = "name" | "status" | "active" | "note";

/** One row of the directory. Registered players and my own characters share this shape. */
interface Row {
  key: string;
  name: string;
  server: string;
  cls: string | null;
  disc: string | null;
  status: RPStatus | null;
  lfrp: boolean;
  instance: number | null;
  planetId: string | null;
  where: string;
  lastActive: number;
  hue: number;
  isMe: boolean;
  isSeen: boolean;
  areaName?: string | null;
}

/** A row for someone we only know from logs or a friend list: name, server and where they were last seen. */
function ghostRow(
  key: string,
  name: string,
  server: string,
  areaId: string | null,
  areaName: string | null | undefined,
  lastActive: number,
): Row {
  return {
    key,
    name,
    server,
    cls: null,
    disc: null,
    status: null,
    lfrp: false,
    instance: null,
    planetId: areaId,
    where: areaId || areaName ? placeLabel(areaId, areaName) : "-",
    lastActive,
    hue: 0,
    isMe: false,
    isSeen: true,
    areaName: areaName ?? null,
  };
}

function toRow(p: Player): Row {
  const loc = !p.isSeen && p.z ? locate(p.planetId, p.x, p.y, p.z) : null;
  return {
    key: p.key,
    name: p.name,
    server: p.server,
    cls: p.cls,
    disc: p.disc,
    status: p.isSeen ? null : p.status,
    lfrp: !!p.lfrp,
    instance: p.instance ?? null,
    planetId: p.planetId,
    where: loc ? loc.path.slice(1).join(" › ") || loc.label : placeLabel(p.planetId, p.areaName),
    lastActive: p.lastActive,
    hue: p.hue,
    isMe: !!p.isMe,
    isSeen: !!p.isSeen,
    areaName: p.areaName,
  };
}

export function Registry() {
  const server = useApp((s) => s.server);
  const me = useApp(selectMe);
  const myChars = useApp((s) => s.myChars);
  const encounters = useApp((s) => s.encounters);
  const friends = useApp((s) => s.friends);
  const met = useApp((s) => s.met);
  const notes = useApp((s) => s.notes);
  // imported in-game notes are keyed by name until the person's id is known; read them either way
  const noteOf = (r: Row) => notePreview(notes[r.key] ?? notes[noteKeyByName(r.server, r.name)]);
  const openModal = useApp((s) => s.openModal);
  const selectPlanet = useApp((s) => s.selectPlanet);
  const search = useApp((s) => s.search)
    .trim()
    .toLowerCase();
  useApp((s) => s.clock);
  const [tab, setTab] = useState<Tab>("online");
  const [status, setStatus] = useState<RPStatus | "">("");
  const [onlyLfrp, setOnlyLfrp] = useState(false);
  const [planet, setPlanet] = useState<string>("");
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: "active", d: -1 });

  // ---- data: live presence (websocket) on top of the server's registry (everyone who ever shared here)
  const livePlayers = useApp((s) => selectLive(s, server));
  const reg = useApp((s) => s.registry[server]);
  const loadRegistry = useApp((s) => s.loadRegistry);
  useEffect(() => {
    void loadRegistry(server);
    const id = setInterval(() => void loadRegistry(server), 60_000);
    return () => clearInterval(id);
  }, [server, loadRegistry]);
  const registered = useMemo<Row[]>(() => {
    const byKey = new Map<string, Player>();
    for (const p of reg?.players ?? []) byKey.set(p.key, p);
    for (const p of livePlayers) byKey.set(p.key, p); // live beats the snapshot
    if (me && me.server === server) byKey.set(me.key, me);
    const list = [...byKey.values()];
    return list.map(toRow);
  }, [livePlayers, reg, server, me]);
  const mine = useMemo<Row[]>(
    () =>
      myChars
        .filter((c) => c.server === server)
        .map((c) => {
          const pl = planetForArea(c.area);
          const key = `${c.server}:${c.id}`;
          const loc = c.pos ? locate(pl?.id, c.pos.x, c.pos.y, c.pos.z) : null;
          return {
            key,
            name: c.name,
            server: c.server,
            cls: c.cls,
            disc: c.disc,
            status: me?.key === key ? me.status : null,
            lfrp: me?.key === key ? !!me.lfrp : false,
            instance: me?.key === key ? (me.instance ?? null) : null,
            planetId: pl?.id ?? null,
            where: loc ? loc.path.slice(1).join(" › ") || loc.label : c.area ? placeLabel(c.area.id, c.area.name) : "-",
            lastActive: c.lastEventMs ?? c.lastSeen,
            hue: hueOf(c.id),
            isMe: true,
            isSeen: false,
            areaName: c.area?.name ?? null,
          };
        }),
    [myChars, server, me],
  );
  // people on Hydian never appear as sightings: they decide what to show
  const seen = useMemo<Row[]>(
    () =>
      encounters
        .filter((e) => e.server === server && !registered.some((r) => r.key === `${e.server}:${e.id}`))
        .map((e) => ghostRow(`${e.server}:${e.id}`, e.name, e.server, e.areaId, e.areaName, e.lastSeen)),
    [encounters, server, registered],
  );

  // friends: the live/registry row if we have one, else the local sighting, else just the name
  const friendRows = useMemo<Row[]>(
    () =>
      Object.entries(friends)
        .filter(([, f]) => f.server === server)
        .map(([key, f]) => {
          const r = registered.find((x) => x.key === key) ?? seen.find((x) => x.key === key);
          if (r) return r;
          const m = met[key];
          const area = m?.lastArea ?? null;
          return ghostRow(key, f.name, f.server, area, area ? m?.areaNames?.[area] : null, m?.last ?? 0);
        }),
    [friends, server, registered, seen, met],
  );
  const online = registered.filter((r) => presenceOf(r.lastActive) !== "gone");
  const counts = {
    online: online.length,
    ic: online.filter((r) => r.status === "ic").length,
    lfrp: online.filter((r) => r.lfrp).length,
    all: registered.length,
  };

  let rows: Row[] =
    tab === "online"
      ? online
      : tab === "all"
        ? registered
        : tab === "mine"
          ? mine
          : tab === "friends"
            ? friendRows
            : seen;
  if (status) rows = rows.filter((r) => r.status === status);
  if (onlyLfrp) rows = rows.filter((r) => r.lfrp);
  if (planet) rows = rows.filter((r) => r.planetId === planet);
  if (search)
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(search) ||
        r.where.toLowerCase().includes(search) ||
        noteOf(r).toLowerCase().includes(search),
    );
  const cmp: Record<SortKey, (a: Row, b: Row) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    status: (a, b) => (a.status ?? "zz").localeCompare(b.status ?? "zz"),
    active: (a, b) => a.lastActive - b.lastActive,
    note: (a, b) => noteOf(a).localeCompare(noteOf(b)),
  };
  rows = [...rows].sort(
    (a, b) =>
      Number(b.isMe) - Number(a.isMe) ||
      Number(!!friends[b.key]) - Number(!!friends[a.key]) ||
      cmp[sort.k](a, b) * sort.d,
  );
  const th = (k: SortKey, label: string) => (
    <th
      className={sort.k === k ? "on" : ""}
      onClick={() => setSort({ k, d: sort.k === k ? (sort.d === 1 ? -1 : 1) : k === "active" ? -1 : 1 })}
    >
      {label}
      {sort.k === k && <span className="dir">{sort.d === 1 ? "▲" : "▼"}</span>}
    </th>
  );
  const planetsHere = PLANETS.filter((p) => registered.some((r) => r.planetId === p.id));

  return (
    <div className="registry scroll">
      <div className="reg-summary">
        <div className="stat">
          <b>{counts.online}</b>
          <span>online on {SERVER_NAMES[server]}</span>
        </div>
        <div className="stat">
          <b style={{ color: STATUS_META.ic.color }}>{counts.ic}</b>
          <span>in character</span>
        </div>
        <div className="stat">
          <b style={{ color: LFRP_COLOR }}>{counts.lfrp}</b>
          <span>looking for RP</span>
        </div>
        <div className="stat">
          <b>{counts.all}</b>
          <span>on Hydian</span>
        </div>
      </div>

      <ActivityPanel server={server} />

      <div className="reg-tabs">
        {(
          [
            ["online", `Online now · ${online.length}`],
            ["all", `Everyone · ${registered.length}`],
            ["mine", `My characters · ${mine.length}`],
            ["friends", `Friends · ${friendRows.length}`],
            ["seen", `Not on Hydian · ${seen.length}`],
          ] as [Tab, string][]
        ).map(([t, l]) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
        <span className="grow" />
        {tab !== "seen" && tab !== "mine" && tab !== "friends" && (
          <div className="reg-filters">
            {(Object.keys(STATUS_META) as RPStatus[])
              .filter((k) => k !== "invisible")
              .map((k) => (
                <button
                  key={k}
                  className={`f ${status === k ? "on" : ""}`}
                  style={{ "--sc": STATUS_META[k].color } as React.CSSProperties}
                  onClick={() => setStatus(status === k ? "" : k)}
                >
                  <i className="d" />
                  {STATUS_META[k].short}
                </button>
              ))}
            <button
              className={`f ${onlyLfrp ? "on" : ""}`}
              style={{ "--sc": LFRP_COLOR } as React.CSSProperties}
              onClick={() => setOnlyLfrp(!onlyLfrp)}
            >
              <i className="d" />
              LFRP
            </button>
            <Select value={planet || "all"} onValueChange={(v) => setPlanet(v === "all" ? "" : v)}>
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                <SelectItem value="all">All planets</SelectItem>
                {planetsHere.map((p) => (
                  <SelectItem key={p.slug} value={p.id ?? p.slug}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="reg-empty">
          {reg?.error && tab !== "mine" && tab !== "seen"
            ? `Could not reach the Hydian server: ${reg.error}`
            : tab === "online"
              ? "No one on Hydian is online on this server right now."
              : tab === "seen"
                ? "Your combat log has not mentioned anyone on this server yet."
                : tab === "mine"
                  ? "None of your characters has logged in on this server yet."
                  : tab === "friends"
                    ? "No friends on this server yet. Open a profile and press Add friend."
                    : "Nothing matches these filters."}
        </div>
      ) : (
        <table className="reg-table">
          <thead>
            <tr>
              {th("name", "Character")}
              {tab !== "seen" && th("status", "Status")}
              {th("active", "Last seen")}
              {th("note", "Note")}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pres = presenceOf(r.lastActive);
              const pl = r.planetId ? planetById(r.planetId) : undefined;
              return (
                <tr
                  key={r.key}
                  className={`${r.isMe ? "me" : ""} ${r.isSeen ? "ghost" : ""} ${pres}`}
                  onClick={() => openModal({ kind: "profile", key: r.key })}
                >
                  <td className="who">
                    <div className="cell">
                      <Avatar p={{ name: r.name, hue: r.hue }} status={r.status ?? undefined} ghost={r.isSeen} />
                      <div className="t">
                        <div className="nm">
                          {r.name}
                          {r.isMe && <span className="you">YOU</span>}
                          {friends[r.key] && (
                            <Tip label="Friend">
                              <span className="star">{Icons.friendOn({ width: 11, height: 11 })}</span>
                            </Tip>
                          )}
                          {r.lfrp && r.status && r.status !== "invisible" && <span className="lfrp-tag">LFRP</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  {tab !== "seen" && (
                    <td className="st">
                      {r.status ? (
                        <>
                          <span
                            className="chip st"
                            style={{ "--sc": STATUS_META[r.status].color } as React.CSSProperties}
                          >
                            <i className="d" />
                            {STATUS_META[r.status].label}
                          </span>
                        </>
                      ) : (
                        <span className="empty">-</span>
                      )}
                    </td>
                  )}
                  <td className="where">
                    <div className="cell">
                      <PlaceIcon areaId={r.planetId} areaName={r.areaName} size={20} />
                      <div className="t">
                        <div className="loc">
                          {r.where}
                          {r.instance ? (
                            <Tip label="Server instance, set by the player">
                              <span className="inst-tag">{r.instance}</span>
                            </Tip>
                          ) : null}
                        </div>
                        <div className="when">
                          <i className={`pres ${pres}`} />
                          {pres === "active" ? "active now" : ago(r.lastActive)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="memo">
                    {noteOf(r) ? <span className="preview">{noteOf(r)}</span> : <span className="empty">-</span>}
                  </td>
                  <td className="act">
                    {pl && !r.isSeen && (
                      <Tip label="Show on the map">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectPlanet(pl.slug);
                          }}
                        >
                          {Icons.map()}
                        </Button>
                      </Tip>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

import { useMemo, useState, type CSSProperties } from "react";
import { CATEGORIES, PLANETS, BIOME_PALETTES, planetForArea, type Planet } from "../data/planets";
type PlanetSort = "groups" | "busy" | "az";
import { serverById } from "../data/servers";
import { SERVER_NAMES } from "../core/gamelink";
import { INSTANCES, STATUS_META, hueOf, type RPStatus } from "../model";
import { useApp } from "../store";
import { selectCounts, selectMe, selectMyStatus } from "../selectors";
import { Avatar, Icons, PlanetIcon } from "./bits";
import { Tip } from "./Tip";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const server = useApp((s) => s.server);
  const planet = useApp((s) => s.planet);
  const selectPlanet = useApp((s) => s.selectPlanet);
  const counts = useApp(selectCounts);
  const me = useApp(selectMe);
  const link = useApp((s) => s.link);
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<PlanetSort>(() => {
    try {
      return (localStorage.getItem("hydian:planetSort") as PlanetSort) || "groups";
    } catch {
      return "groups";
    }
  });
  const pickSort = (v: PlanetSort) => {
    setSort(v);
    try {
      localStorage.setItem("hydian:planetSort", v);
    } catch {
      /* ignore */
    }
  };
  const srv = serverById(server);
  const herePid = me?.server === server ? me.planetId : null;

  // "groups": the game's regions, busiest planet first inside each; "busy": one flat list, busiest first, empty
  // planets alphabetically at the end; "az": one flat alphabetical list.
  const groups = useMemo(() => {
    const match = (p: Planet) => !q || p.name.toLowerCase().includes(q.toLowerCase());
    const count = (p: Planet) => counts.byPlanet[p.id ?? `slug:${p.slug}`] ?? 0;
    if (sort === "groups")
      return CATEGORIES.map((cat) => ({
        cat,
        items: PLANETS.filter((p) => p.category === cat && match(p))
          .map((p, i) => ({ p, i, n: count(p) }))
          .sort((a, b) => b.n - a.n || a.i - b.i)
          .map((x) => x.p),
      })).filter((g) => g.items.length);
    const flat = PLANETS.filter(match).sort(
      (a, b) => (sort === "busy" ? count(b) - count(a) : 0) || a.name.localeCompare(b.name),
    );
    return flat.length ? [{ cat: sort === "busy" ? "Busiest first" : "All planets", items: flat }] : [];
  }, [q, counts, sort]);

  return (
    <aside className="side">
      <div className="side-head" data-tauri-drag-region>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: `hsl(${srv?.hue ?? 0} 55% 50%)` }} />
        {srv?.name ?? server}
        <span className="sub">{srv?.region}</span>
      </div>
      <div className="side-search">
        {Icons.search()}
        <input placeholder="Find a planet" value={q} onChange={(e) => setQ(e.target.value)} />
        <DropdownMenu>
          <Tip label="Sort planets">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className={sort !== "groups" ? "text-primary" : ""}>
                {Icons.sort()}
              </Button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Sort planets</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => pickSort(v as PlanetSort)}>
              {(
                [
                  ["groups", "By region", "The game's regions, busiest first in each"],
                  ["busy", "Busiest first", "One list, most people on top"],
                  ["az", "A to Z", "One alphabetical list"],
                ] as [PlanetSort, string, string][]
              ).map(([v, l, h]) => (
                <DropdownMenuRadioItem key={v} value={v} className="items-start py-1.5">
                  <span className="flex flex-col">
                    <span>{l}</span>
                    <span className="text-xs text-muted-foreground">{h}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {link.status === "scanning" && (
        <div className="progress">
          <i style={{ width: `${link.progress[1] ? (100 * link.progress[0]) / link.progress[1] : 0}%` }} />
        </div>
      )}
      <div className="scroll" style={{ flex: 1, paddingBottom: 8 }}>
        {groups.map((g) => {
          const total = g.items.reduce((a, p) => a + (counts.byPlanet[p.id ?? `slug:${p.slug}`] ?? 0), 0);
          const col = !!collapsed[g.cat];
          return (
            <div key={g.cat}>
              <div
                className={`cat ${col ? "collapsed" : ""}`}
                onClick={() => setCollapsed({ ...collapsed, [g.cat]: !col })}
              >
                {Icons.chevron()}
                {g.cat}
                <span className="n">{total || ""}</span>
              </div>
              {!col &&
                g.items.map((p) => {
                  const pid = p.id ?? `slug:${p.slug}`;
                  const n = counts.byPlanet[pid] ?? 0;
                  return (
                    <div
                      key={p.slug}
                      className={`planet ${planet === p.slug ? "active" : ""}`}
                      onClick={() => selectPlanet(p.slug)}
                      style={{ "--c": BIOME_PALETTES[p.biome].accent } as CSSProperties}
                    >
                      <PlanetIcon slug={p.slug} size={22} faction={p.faction} />
                      <span className="nm">{p.name}</span>
                      {herePid === pid && (
                        <Tip label="You are here">
                          <span className="here" />
                        </Tip>
                      )}
                      <span className={`cnt ${n >= 8 ? "hot" : ""}`}>{n || ""}</span>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
      <UserPanel />
    </aside>
  );
}

export function UserPanel() {
  const me = useApp(selectMe);
  const link = useApp((s) => s.link);
  const live = useApp((s) => s.live);
  const followMe = useApp((s) => s.followMe);
  const setFollowMe = useApp((s) => s.setFollowMe);
  const openModal = useApp((s) => s.openModal);
  const [open, setOpen] = useState(false);
  const linkText = {
    idle: "Game link: starting…",
    scanning: "Game link: reading your logs…",
    live: `Game link: live · ${live?.area?.name ?? "waiting for an area"}`,
    nolog: "Game link: no combat log found. Enable combat logging in the game preferences",
    error: `Game link error: ${link.error ?? ""}`,
  }[link.status];

  const { status: myStatus, lfrp } = useApp(selectMyStatus);
  const setLfrp = useApp((s) => s.setLfrp);
  const shared = !!me && myStatus !== "invisible";
  return (
    <div className="user-panel">
      <Tip
        label={shared ? "A beacon on the map: you are open to walk-ups" : "Set a status other than Invisible first"}
        side="right"
      >
        <div className={`lfrp-bar ${shared ? "" : "off"} ${lfrp && shared ? "on" : ""}`}>
          <span className="d" />
          <span className="l">Looking for RP</span>
          <Switch size="sm" checked={lfrp && shared} disabled={!shared} onCheckedChange={() => setLfrp(!lfrp)} />
        </div>
      </Tip>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="who">
            {me ? (
              <Avatar p={me} status={me.status} bg="var(--bg-side)" />
            ) : (
              <div className="avatar" style={{ "--h": 0, background: "var(--bg-raised)" } as CSSProperties}>
                ?
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="nm">{me?.name ?? "No character"}</div>
              <div className="st">
                {me
                  ? `${STATUS_META[me.status].label}${me.lfrp && me.status !== "invisible" ? " · Looking for RP" : ""}`
                  : "No character linked yet"}
              </div>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" sideOffset={10} className="pop w-[300px]">
          <StatusPopover onClose={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
      <Tip label={followMe ? "Following your character" : "Follow your character: switch planet when you zone"}>
        <Button
          variant="ghost"
          size="icon-sm"
          className={followMe ? "text-primary" : ""}
          onClick={() => setFollowMe(!followMe)}
        >
          {Icons.follow()}
        </Button>
      </Tip>
      <Tip label={linkText}>
        <Button variant="ghost" size="icon-sm" onClick={() => openModal({ kind: "settings" })}>
          <span className={`link-dot ${link.status}`} />
        </Button>
      </Tip>
    </div>
  );
}

function StatusPopover({ onClose }: { onClose: () => void }) {
  const busy = useApp((s) => !!(s.activeKey && s.characterActions[s.activeKey]));
  const me = useApp(selectMe);
  const { status: myStatus, instance } = useApp(selectMyStatus);
  const setStatus = useApp((s) => s.setStatus);
  const setInstance = useApp((s) => s.setInstance);
  const myChars = useApp((s) => s.myChars);
  const setActive = useApp((s) => s.setActive);
  const openModal = useApp((s) => s.openModal);
  const recent = [...myChars].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 4);

  return (
    <>
      {me && (
        <div className="hd">
          <Avatar p={me} status={me.status} bg="var(--bg-side)" />
          <div>
            <div className="nm">{me.name}</div>
            <div className="sv">{SERVER_NAMES[me.server]}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            style={{ marginLeft: "auto", padding: "4px 8px" }}
            onClick={() => {
              openModal({ kind: "profile", key: me.key });
              onClose();
            }}
          >
            Profile
          </Button>
        </div>
      )}
      <div className="sect">{busy ? "Updating privacy…" : "Status"}</div>
      {(Object.keys(STATUS_META) as RPStatus[]).map((k) => (
        <button
          key={k}
          className={`item ${myStatus === k ? "on" : ""}`}
          style={{ "--sc": STATUS_META[k].color } as CSSProperties}
          disabled={busy}
          onClick={() => void setStatus(k)}
        >
          <span className="d" />
          <div>
            <div className="l">{STATUS_META[k].label}</div>
            <div className="h">{STATUS_META[k].hint}</div>
          </div>
        </button>
      ))}

      {myStatus !== "invisible" && (
        <div className="item inst">
          <span className="d" style={{ background: "var(--text-faint)" }} />
          <div style={{ flex: 1 }}>
            <div className="l">Instance</div>
            <div className="h">{instance ? `You are on instance ${instance}` : "Not set. Resets on zone change"}</div>
          </div>
          <div className="inst-pick">
            <Tip label="Not set">
              <button className={!instance ? "on" : ""} onClick={() => setInstance(null)}>
                -
              </button>
            </Tip>
            {INSTANCES.map((n) => (
              <button
                key={n}
                className={instance === n ? "on" : ""}
                onClick={() => setInstance(instance === n ? null : n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      {recent.length > 0 && (
        <>
          <div className="line" />
          <div className="sect">Switch character</div>
          {recent.map((c) => {
            const key = `${c.server}:${c.id}`;
            const pl = planetForArea(c.area);
            return (
              <button
                key={key}
                className={`item ${me?.key === key ? "on" : ""}`}
                onClick={() => {
                  setActive(key);
                  onClose();
                }}
              >
                <Avatar p={{ name: c.name, hue: hueOf(c.id) }} size="sm" />
                <div>
                  <div className="l">{c.name}</div>
                  <div className="h">
                    {SERVER_NAMES[c.server]} · {pl?.name ?? c.area?.name ?? "-"}
                  </div>
                </div>
              </button>
            );
          })}
          <button
            className="item"
            onClick={() => {
              openModal({ kind: "characters" });
              onClose();
            }}
          >
            <span style={{ width: 24 }} />
            {Icons.swap({ width: 16 })}
            <div className="l">All characters…</div>
          </button>
        </>
      )}
    </>
  );
}

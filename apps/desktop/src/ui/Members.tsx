import { STATUS_META, presenceOf, type Player, type RPStatus } from "../model";
import { useApp } from "../store";
import { selectPlayersOn } from "../selectors";
import { Avatar, Icons } from "./bits";
import { locate } from "../data/maps";
import { Tip } from "./Tip";

const ORDER: RPStatus[] = ["ic", "ooc"];

export function Members() {
  const server = useApp((s) => s.server);
  const slug = useApp((s) => s.planet);
  const players = useApp((s) => selectPlayersOn(s, server, slug));
  const open = useApp((s) => s.membersOpen);
  const setHover = useApp((s) => s.setHover);
  const hoverKey = useApp((s) => s.hoverKey);
  const openModal = useApp((s) => s.openModal);
  const friends = useApp((s) => s.friends);
  const search = useApp((s) => s.search)
    .trim()
    .toLowerCase();
  useApp((s) => s.showPhases); // re-render when phase visibility changes (affects location labels)

  const groups = ORDER.map((st) => ({
    st,
    items: players
      .filter((p) => !p.isSeen && p.status === st && (!search || p.name.toLowerCase().includes(search)))
      .sort(
        (a, b) =>
          Number(!!b.isMe) - Number(!!a.isMe) ||
          Number(!!friends[b.key]) - Number(!!friends[a.key]) ||
          Number(!!b.lfrp) - Number(!!a.lfrp) ||
          a.name.localeCompare(b.name),
      ),
  })).filter((g) => g.items.length);

  return (
    <aside className={`members ${open ? "" : "closed"}`}>
      <div className="members-head">
        On this planet <span className="n">{players.length}</span>
      </div>
      <div className="scroll" style={{ flex: 1, paddingBottom: 12 }}>
        {groups.map((g) => (
          <div key={g.st}>
            <div className="mgroup">
              {STATUS_META[g.st].label}
              <span className="n">{g.items.length}</span>
            </div>
            {g.items.map((p) => (
              <Row
                key={p.key}
                p={p}
                starred={!!friends[p.key]}
                hovered={hoverKey === p.key}
                onHover={setHover}
                onOpen={() => openModal({ kind: "profile", key: p.key })}
              />
            ))}
          </div>
        ))}
        {!groups.length && (
          <div style={{ padding: 24, color: "var(--text-faint)", textAlign: "center", fontSize: 13 }}>
            No one on Hydian here right now.
          </div>
        )}
      </div>
    </aside>
  );
}

function Row({
  p,
  starred,
  hovered,
  onHover,
  onOpen,
}: {
  p: Player;
  starred?: boolean;
  hovered: boolean;
  onHover: (k: string | null) => void;
  onOpen: () => void;
}) {
  const loc = p.isMe && p.z ? locate(p.planetId?.startsWith("slug:") ? null : p.planetId, p.x, p.y, p.z) : null;
  return (
    <div
      className={`member ${p.isMe ? "me" : ""} ${p.isSeen ? "ghost" : ""} ${p.lfrp && p.status !== "invisible" ? "lfrp" : ""}`}
      style={hovered ? { background: "var(--bg-hover)" } : undefined}
      onMouseEnter={() => onHover(p.key)}
      onMouseLeave={() => onHover(null)}
      onClick={onOpen}
    >
      <Avatar p={p} status={p.isSeen ? undefined : p.status} ghost={p.isSeen} />
      <div className="t">
        <div className="nm">
          {p.name}
          {p.isMe && <span className="you">YOU</span>}
          {starred && (
            <Tip label="Friend">
              <span className="star">{Icons.friendOn({ width: 11, height: 11 })}</span>
            </Tip>
          )}
          {!p.isSeen && p.lfrp && p.status !== "invisible" && <span className="lfrp-tag">LFRP</span>}
        </div>
        <div className="st">
          <>
            {loc ? `${loc.label}` : STATUS_META[p.status].label}
            {p.instance ? ` · instance ${p.instance}` : ""}
            {presenceOf(p.lastActive) === "idle"
              ? ` · idle ${Math.round((Date.now() - p.lastActive) / 60000)} min`
              : ""}
          </>
        </div>
      </div>
    </div>
  );
}

import { useState, type CSSProperties } from "react";
import { SERVER_NAMES } from "../core/gamelink";
import { locate, planetIcon } from "../data/maps";
import { planetById } from "../data/planets";
import { STATUS_META, LFRP_COLOR, presenceOf, type Player, type RPStatus } from "../model";
import { useApp } from "../store";
import { selectMe, selectMyStatus } from "../selectors";
import { Avatar, EditorHelp, Icons, PlaceIcon, PlanetIcon, Private, ago } from "./bits";
import { Editor } from "./Editor";
import { textToBlocks, type PersonNote } from "../core/notes";

/** Private notes about a character: starts from the in-game friends-list note when there is one. Local only. */
function NotesCard({ p }: { p: Player }) {
  const note = useApp((s) => s.noteFor(p.key, p.name, p.server));
  const putNote = useApp((s) => s.putNote);
  const doc = note?.doc ?? (note?.text ? textToBlocks(note.text) : null);
  const save = (blocks: unknown[], text: string) => {
    const n: PersonNote = {
      key: note?.key ?? p.key,
      name: p.name,
      server: p.server,
      doc: blocks,
      text,
      updated: Date.now(),
      imported: note?.imported,
    };
    void putNote(n);
  };
  return (
    <div className="notes">
      <div className="notes-head">
        <b>Notes</b>
        <Private what="Your notes" />
        <span style={{ flex: 1 }} />
        <EditorHelp note={note?.imported ? `Started from the in-game note of ${note.imported.from}.` : undefined} />
      </div>
      <Editor
        doc={doc}
        placeholder="Anything you want to remember about them: who they are to you, threads to pick up, how a scene went…"
        onChange={save}
      />
    </div>
  );
}
import { usualAreas, type MetEntry } from "../core/met";
import { Tip } from "./Tip";
import { Button } from "@/components/ui/button";
import { placeLabel } from "../data/places";
import { CLASSES } from "../data/servers";
import { FactionMark } from "./bits";

/** "Seen around": where and when this character turned up in your own logs. Stored on this device. */
function MetCard({ e, name }: { e: MetEntry; name: string }) {
  const places = usualAreas(e, 4).map(([id, n]) => ({ id, planet: planetById(id), n }));
  const max = Math.max(1, ...places.map((x) => x.n));
  const days = Math.max(1, Math.round((e.last - e.first) / 86_400_000));
  return (
    <div className="metcard">
      <div className="mc-head">
        <b>Seen around</b>
        <span>from your combat logs</span>
      </div>
      <div className="mc-stats two">
        <div>
          <b>{ago(e.last)}</b>
          <span>last seen nearby{e.lastArea ? ` · ${placeLabel(e.lastArea, e.areaNames?.[e.lastArea])}` : ""}</span>
        </div>
        <div>
          <b>{new Date(e.first).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</b>
          <span>first seen{e.times > 1 && days > 1 ? ` · ${days} days ago` : ""}</span>
        </div>
      </div>
      {places.length > 0 && (
        <div className="mc-places">
          <div className="mc-label">Where you have seen {name.split(" ")[0]}</div>
          {places.map(({ id, planet, n }, i) => (
            <div key={i} className="mc-place">
              <PlaceIcon areaId={id} areaName={e.areaNames?.[id]} size={22} />
              <span className="nm">{planet?.name ?? placeLabel(id, e.areaNames?.[id])}</span>
              <span className="bar">
                <i style={{ width: `${(100 * n) / max}%` }} />
              </span>
              <span className="n">{n}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Character profile. Nothing on it is self-authored text: identity comes from the game log
 * (name, server, class), presence from the log's timestamps, status from a fixed list.
 * Unregistered characters (seen in someone's log) show only name, server and last seen.
 */
export function ProfileModal({ p, close }: { p: Player; close: () => void }) {
  const me = useApp(selectMe);
  const setActive = useApp((s) => s.setActive);
  const setStatus = useApp((s) => s.setStatus);
  const setLfrp = useApp((s) => s.setLfrp);
  const { status: myStatus, lfrp: myLfrp } = useApp(selectMyStatus);
  const selectPlanet = useApp((s) => s.selectPlanet);
  const selectServer = useApp((s) => s.selectServer);
  const friend = useApp((s) => s.friends[p.key]);
  const isFriend = !!friend;
  const startEntryWith = useApp((s) => s.startEntryWith);
  const faction = p.faction ?? (p.cls ? CLASSES[p.cls]?.faction : undefined);
  const toggleFriend = useApp((s) => s.toggleFriend);
  const met = useApp((s) => s.met[p.key]);

  const followBtn = !p.isMe && (
    <Tip
      label={
        isFriend ? "Remove from friends" : "Friends sort first and you get a note when they show up or look for RP."
      }
    >
      {isFriend ? (
        <button className="friend-mark" onClick={() => toggleFriend(p.key, p.name, p.server)}>
          {Icons.friendOn({ width: 15, height: 15 })} Friends
        </button>
      ) : (
        <Button size="sm" onClick={() => toggleFriend(p.key, p.name, p.server)}>
          {Icons.friendAdd({ width: 14, height: 14 })} Add friend
        </Button>
      )}
    </Tip>
  );
  const own = !!p.isMe;
  const active = own && me?.key === p.key;
  const hue = p.hue;
  const [pick, setPick] = useState(false);
  const planet = p.planetId ? planetById(p.planetId) : undefined;
  const loc = !p.isSeen && p.z ? locate(p.planetId, p.x, p.y, p.z) : null;
  const presence = presenceOf(p.lastActive);
  const when = p.lastActive ? ago(p.lastActive) : "never";

  // ---------------------------------------------------------------- unregistered: name + last seen only
  if (p.isSeen) {
    return (
      <div className="modal profile" style={{ "--h": hue } as CSSProperties}>
        <div className="banner ghost">
          <Button variant="ghost" size="icon-sm" className="close" onClick={close}>
            {Icons.x()}
          </Button>
        </div>
        <div className="prof-head">
          <Avatar p={{ name: p.name, hue }} size="lg" ghost />
          <div className="title">
            <h2>
              {p.name} <span className="srv">{SERVER_NAMES[p.server] ?? p.server}</span>
            </h2>
            <div className="meta">
              <span className="chip ghost">Not on Hydian</span>
              {isFriend && (
                <span className="chip friend">
                  <i>{Icons.friendOn({ width: 11, height: 11 })}</i>Friend
                  {friend?.via ? <em> · with {friend.via}</em> : null}
                </span>
              )}
            </div>
          </div>
          <div className="prof-actions">
            <Tip label="A journal entry with this person already in it">
              <Button variant="secondary" size="sm" onClick={() => startEntryWith(p)}>
                {Icons.book({ width: 14, height: 14 })} Journal
              </Button>
            </Tip>
            {followBtn}
          </div>
        </div>
        <div className="prof cols scroll">
          <div className="col-main">
            <div className="facts">
              <div className="fact">
                <span className="k">Last seen</span>
                <span className="v">{when}</span>
              </div>
              <div className="fact">
                <span className="k">Seen where</span>
                <span className="v">
                  {planet ? (
                    <>
                      <PlanetIcon slug={planet.slug} size={18} faction={planet.faction} /> {planet.name}
                    </>
                  ) : (
                    <>
                      <PlaceIcon areaId={p.planetId} areaName={p.areaName} size={18} />{" "}
                      {placeLabel(p.planetId, p.areaName)}
                    </>
                  )}
                </span>
              </div>
            </div>
            {met && <MetCard e={met} name={p.name} />}
          </div>
          <div className="col-notes">
            <NotesCard p={p} />
          </div>
        </div>
        <div className="foot">
          <span style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- registered
  const bannerIcon = planet ? planetIcon(planet.slug) : undefined;
  return (
    <div className="modal profile" style={{ "--h": hue } as CSSProperties}>
      <div className="banner">
        {bannerIcon && <img className="banner-planet" src={bannerIcon} alt="" draggable={false} />}
        <Button variant="ghost" size="icon-sm" className="close" onClick={close}>
          {Icons.x()}
        </Button>
      </div>
      <div className="prof-head">
        <Avatar p={{ name: p.name, hue }} size="lg" status={p.status !== "invisible" ? p.status : undefined} />
        <div className="title">
          <h2>
            {p.name}
            {active && <span className="you">YOU</span>}
          </h2>
          <div className="meta">
            <span className="srv">{SERVER_NAMES[p.server] ?? p.server}</span>
            <span className="dot" />
            <span className="chip reg">On Hydian</span>
            {isFriend && (
              <span className="chip friend">
                <i>{Icons.friendOn({ width: 11, height: 11 })}</i>Friend
                {friend?.via ? <em> · with {friend.via}</em> : null}
              </span>
            )}
            {faction && (
              <span className={`chip fac ${faction}`}>
                <FactionMark faction={faction} size={12} />
                {faction === "imp" ? "Empire" : "Republic"}
              </span>
            )}
          </div>
        </div>
        <div className="prof-actions">
          {!p.isMe && (
            <Tip label="A journal entry with this person already in it">
              <Button variant="secondary" size="sm" onClick={() => startEntryWith(p)}>
                {Icons.book({ width: 14, height: 14 })} Journal
              </Button>
            </Tip>
          )}
          {followBtn}
        </div>
      </div>
      <div className="prof cols scroll">
        <div className="col-main">
          <div className="facts">
            <div className="fact">
              <span className="k">Status</span>
              <span className="v">
                <span className="chip st" style={{ "--sc": STATUS_META[p.status].color } as CSSProperties}>
                  <i className="d" />
                  {STATUS_META[p.status].label}
                </span>
                {p.lfrp && p.status !== "invisible" && (
                  <span className="chip st" style={{ "--sc": LFRP_COLOR } as CSSProperties}>
                    <i className="d" />
                    Looking for RP
                  </span>
                )}
                {p.instance && p.status !== "invisible" ? (
                  <Tip label="Server instance, set by the player">
                    <span className="chip">Instance {p.instance}</span>
                  </Tip>
                ) : null}
                {active && (
                  <Button variant="ghost" size="sm" style={{ padding: "2px 8px" }} onClick={() => setPick(!pick)}>
                    {pick ? "Done" : "Change"}
                  </Button>
                )}
              </span>
            </div>
            {active && pick && (
              <div className="picker">
                <div className="row">
                  {(Object.keys(STATUS_META) as RPStatus[]).map((k) => (
                    <button
                      key={k}
                      className={`opt ${myStatus === k ? "on" : ""}`}
                      style={{ "--sc": STATUS_META[k].color } as CSSProperties}
                      onClick={() => setStatus(k)}
                    >
                      <i className="d" />
                      {STATUS_META[k].label}
                    </button>
                  ))}
                  <button
                    className={`opt ${myLfrp ? "on" : ""}`}
                    style={{ "--sc": LFRP_COLOR } as CSSProperties}
                    onClick={() => setLfrp(!myLfrp)}
                  >
                    <i className="d" />
                    Looking for RP
                  </button>
                </div>
              </div>
            )}
            <div className="fact">
              <span className="k">Location</span>
              <span className="v">
                {planet ? (
                  <>
                    <PlanetIcon slug={planet.slug} size={18} faction={planet.faction} />{" "}
                    {loc ? loc.path.join(" › ") : planet.name}
                  </>
                ) : (
                  <>
                    <PlaceIcon areaId={p.planetId} areaName={p.areaName} size={18} />{" "}
                    {placeLabel(p.planetId, p.areaName)}
                  </>
                )}
                {planet && (
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ padding: "2px 8px" }}
                    onClick={() => {
                      selectServer(p.server);
                      selectPlanet(planet.slug);
                      close();
                    }}
                  >
                    Show on the map
                  </Button>
                )}
              </span>
            </div>
            <div className="fact">
              <span className="k">Last seen</span>
              <span className="v">
                <i className={`pres ${presence}`} />
                {presence === "active" ? "Active now" : when}
                {` · ${planet ? (loc ? loc.label : planet.name) : placeLabel(p.planetId, p.areaName)}`}
              </span>
            </div>
          </div>
          {met && !p.isMe && <MetCard e={met} name={p.name} />}
        </div>
        {!p.isMe && (
          <div className="col-notes">
            <NotesCard p={p} />
          </div>
        )}
      </div>
      <div className="foot">
        {own && !active && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setActive(p.key);
              close();
            }}
          >
            Play as {p.name}
          </Button>
        )}
        <span style={{ flex: 1 }} />
        <Button size="sm" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
}

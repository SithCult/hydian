// Every character found in the logs and the settings folder: pick the one to play as.
import { SERVER_NAMES } from "../../core/gamelink";
import { planetForArea } from "../../data/planets";
import { hueOf } from "../../model";
import { useApp } from "../../store";
import { Avatar, ago } from "../bits";
import { Tip } from "../Tip";
import { Button } from "@/components/ui/button";

export function CharactersModal({ close }: { close: () => void }) {
  const myChars = useApp((s) => s.myChars);
  const rosterList = useApp((s) => s.rosterList);
  const activeKey = useApp((s) => s.activeKey);
  const setActive = useApp((s) => s.setActive);
  const openModal = useApp((s) => s.openModal);
  const known = new Set(myChars.map((c) => `${c.server}:${c.name}`));
  const chars = [...myChars].sort((a, b) => b.lastSeen - a.lastSeen);
  const onlyOnDisk = rosterList.filter((r) => !known.has(`${r.server}:${r.name}`) && SERVER_NAMES[r.server]);
  return (
    <div className="modal settings">
      <div className="body scroll">
        <h2>Your characters</h2>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Found in your combat logs and settings folder. Pick who you are playing as.
        </div>
        <h3>Seen in your combat logs · {chars.length}</h3>
        {chars.map((c) => {
          const key = `${c.server}:${c.id}`;
          const pl = planetForArea(c.area);
          return (
            <div
              key={key}
              className={`char-row ${activeKey === key ? "on" : ""}`}
              onClick={() => {
                setActive(key);
                close();
              }}
            >
              <Avatar p={{ name: c.name, hue: hueOf(c.id) }} />
              <div>
                <div className="nm">{c.name}</div>
                <div className="sub">{SERVER_NAMES[c.server]}</div>
              </div>
              <div className="right">
                {pl?.name ?? c.area?.name ?? "-"}
                <br />
                {ago(c.lastSeen)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                style={{ padding: "4px 8px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal({ kind: "profile", key });
                }}
              >
                Profile
              </Button>
            </div>
          );
        })}
        <h3>Only in the settings folder · {onlyOnDisk.length}</h3>
        <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 6 }}>
          No recent combat log for these. Log in once with combat logging enabled and they appear above.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {onlyOnDisk.map((r) => (
            <Tip key={r.server + r.name} label={SERVER_NAMES[r.server]}>
              <span className="tag">
                {r.name}{" "}
                <span style={{ opacity: 0.6 }}>
                  ·{" "}
                  {SERVER_NAMES[r.server]
                    ?.split(" ")
                    .map((w) => w[0])
                    .join("")}
                </span>
              </span>
            </Tip>
          ))}
        </div>
      </div>
      <div className="foot">
        <Button size="sm" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
}

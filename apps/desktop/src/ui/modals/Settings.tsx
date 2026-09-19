// Settings: one tab per concern, Discord-style.
import { useState } from "react";
import { isTauri, pickFolder } from "../../core/fs";
import { useApp } from "../../store";
import { Private } from "../bits";
import { Logo } from "../Logo";
import { MOD, modShift } from "../../core/platform";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

function PathRow({
  value,
  onPick,
  title,
  placeholder,
}: {
  value: string;
  onPick: (v: string) => void;
  title: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  return (
    <span className="v path-row">
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty) onPick(draft.trim());
        }}
        spellCheck={false}
      />
      {dirty && (
        <Button variant="secondary" size="sm" onClick={() => onPick(draft.trim())}>
          Use
        </Button>
      )}
      {isTauri() && (
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            const r = await pickFolder(title, value || undefined);
            if (r) {
              setDraft(r);
              onPick(r);
            }
          }}
        >
          Browse…
        </Button>
      )}
    </span>
  );
}

const LINK_LABEL: Record<string, string> = {
  idle: "Starting",
  scanning: "Reading logs",
  live: "Live",
  nolog: "No combat log found",
  error: "Error",
};
const UPLINK_LABEL: Record<string, string> = {
  off: "Off",
  idle: "Connected",
  sending: "Sending",
  live: "Live",
  error: "Error",
};

type Tab = "game" | "overlay" | "startup" | "map" | "privacy" | "about";
const TABS: { id: Tab; label: string }[] = [
  { id: "game", label: "Game link" },
  { id: "overlay", label: "In-game overlay" },
  { id: "startup", label: "Startup" },
  { id: "map", label: "Map" },
  { id: "privacy", label: "Privacy" },
  { id: "about", label: "About" },
];
const Range = ({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) => (
  <Slider className="w-[140px]" min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
);
const Toggle = ({
  title,
  hint,
  on,
  onToggle,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  on: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) => (
  <div className="toggle">
    <div className="l">
      <b>{title}</b>
      {hint && <span>{hint}</span>}
      {children}
    </div>
    <Switch checked={on} onCheckedChange={onToggle} />
  </div>
);

export function SettingsModal({ close }: { close: () => void }) {
  const [tab, setTab] = useState<Tab>("game");
  return (
    <div className="modal settings tabbed">
      <nav className="settings-nav">
        <div className="settings-title">Settings</div>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <div className="settings-nav-foot">Esc to close</div>
      </nav>
      <div className="settings-main">
        <div className="body scroll">
          <h2>{TABS.find((t) => t.id === tab)!.label}</h2>
          {tab === "game" && <GameTab />}
          {tab === "overlay" && <OverlayTab />}
          {tab === "startup" && <StartupTab />}
          {tab === "map" && <MapTab />}
          {tab === "privacy" && <PrivacyTab />}
          {tab === "about" && <AboutTab />}
        </div>
        <div className="foot">
          <Button size="sm" onClick={close}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function GameTab() {
  const paths = useApp((s) => s.paths);
  const link = useApp((s) => s.link);
  const rescan = useApp((s) => s.rescan);
  const setPaths = useApp((s) => s.setPaths);
  const resetPaths = useApp((s) => s.resetPaths);
  const pathsCustom = useApp((s) => s.pathsCustom);
  const myChars = useApp((s) => s.myChars);
  const rosterList = useApp((s) => s.rosterList);
  const live = useApp((s) => s.live);
  const scanMs = useApp((s) => s.scanMs);
  const [adv, setAdv] = useState(Object.keys(pathsCustom).length > 0);
  return (
    <>
      <div className="kv">
        <span className="k">Status</span>
        <span className="v">
          <span className={`link-dot ${link.status}`} style={{ display: "inline-block", marginRight: 6 }} />
          {LINK_LABEL[link.status] ?? link.status}
          {link.error ? `: ${link.error}` : ""}
        </span>
        <span className="k">Game data</span>
        <span className="v" style={{ fontFamily: "var(--font)" }}>
          {Object.keys(pathsCustom).filter((k) => k !== "installDir").length ? "Custom folders" : "Auto-detected"}{" "}
          <Button variant="ghost" size="sm" style={{ padding: "0 6px", fontSize: 12 }} onClick={() => setAdv(!adv)}>
            {adv ? "hide" : "advanced…"}
          </Button>
        </span>
        <span className="k">Following</span>
        <span className="v">{link.file ?? "-"}</span>
        <span className="k">Parsed</span>
        <span className="v">
          {link.lines.toLocaleString()} lines · {myChars.length} {myChars.length === 1 ? "character" : "characters"} in
          logs · {rosterList.length} in settings · scan {scanMs} ms
        </span>
        {live?.area && (
          <>
            <span className="k">Live area</span>
            <span className="v">
              {live.area.name}
              {live.area.mode ? ` · ${live.area.mode}` : ""}
            </span>
          </>
        )}
        {live?.pos && (
          <>
            <span className="k">Live position</span>
            <span className="v">
              x {live.pos.x.toFixed(1)} · y {live.pos.y.toFixed(1)} · z {live.pos.z.toFixed(1)} · {live.pos.at}
            </span>
          </>
        )}
      </div>
      {adv && (
        <div className="box" style={{ marginTop: 10 }}>
          <p className="empty" style={{ marginBottom: 10 }}>
            Hydian finds these folders on its own. Change them only if your game keeps them somewhere unusual.
          </p>
          <div className="kv">
            <span className="k">Combat logs</span>
            <PathRow
              value={paths?.logsDir ?? ""}
              onPick={(v) => void setPaths({ logsDir: v })}
              title="Choose the SWTOR CombatLogs folder"
            />
            <span className="k">Settings dir</span>
            <PathRow
              value={paths?.settingsDir ?? ""}
              onPick={(v) => void setPaths({ settingsDir: v })}
              title="Choose the SWTOR settings folder"
            />
          </div>
        </div>
      )}
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <Button variant="secondary" size="sm" onClick={() => void rescan()}>
          Rescan logs
        </Button>
        {Object.keys(pathsCustom).length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void resetPaths()}>
            Reset folders to default
          </Button>
        )}
      </div>
      <p className="note" style={{ marginTop: 12 }}>
        Hydian reads the combat log (<b>Preferences → Combat Logging → Enable Combat Logging to File</b>) and the
        settings folder for character names. A position arrives whenever the game logs an event.
      </p>
    </>
  );
}

function OverlayTab() {
  const overlay = useApp((s) => s.overlay);
  const setOverlay = useApp((s) => s.setOverlay);
  return (
    <>
      <Toggle
        title="Show the overlay"
        hint={
          <>
            A small always-on-top card over the game: who is on Hydian near you, with LFRP beacons and instance numbers.
            Works with the game in windowed or borderless fullscreen (exclusive fullscreen covers it).{" "}
            <kbd>{modShift("O")}</kbd> toggles it anywhere.
          </>
        }
        on={overlay.on}
        onToggle={() => setOverlay({ on: !overlay.on })}
      />
      {overlay.on && (
        <>
          <div className="toggle">
            <div className="l">
              <b>
                {overlay.locked
                  ? "Locked: clicks pass through to the game"
                  : "Unlocked: drag it into place, resize at the edges"}
              </b>
              <span>
                Unlock to move it, lock when it sits right. <kbd>{modShift("L")}</kbd> toggles the lock anywhere.
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setOverlay({ locked: !overlay.locked })}>
              {overlay.locked ? "Unlock" : "Lock"}
            </Button>
          </div>
          <Toggle
            title="Hide while the game is not running"
            hint="The overlay only appears while SWTOR is running."
            on={overlay.autoHide}
            onToggle={() => setOverlay({ autoHide: !overlay.autoHide })}
          />
          <div className="toggle">
            <div className="l">
              <b>Opacity</b>
              <span>{Math.round(overlay.opacity * 100)} %</span>
            </div>
            <Range value={overlay.opacity} min={0.3} max={1} step={0.05} onChange={(v) => setOverlay({ opacity: v })} />
          </div>
          <div className="toggle">
            <div className="l">
              <b>Size</b>
              <span>{Math.round(overlay.scale * 100)} %</span>
            </div>
            <Range value={overlay.scale} min={0.75} max={1.6} step={0.05} onChange={(v) => setOverlay({ scale: v })} />
          </div>
          <div className="toggle">
            <div className="l">
              <b>Rows</b>
              <span>How many nearby players to list before "+N more".</span>
            </div>
            <Range value={overlay.maxRows} min={3} max={16} step={1} onChange={(v) => setOverlay({ maxRows: v })} />
          </div>
        </>
      )}
    </>
  );
}

function StartupTab() {
  const autostart = useApp((s) => s.autostart);
  const setAutostart = useApp((s) => s.setAutostart);
  const startMinimized = useApp((s) => s.startMinimized);
  const setStartMinimized = useApp((s) => s.setStartMinimized);
  return (
    <>
      <Toggle
        title="Launch at startup"
        hint="Start Hydian when you sign in to your computer, so the game link keeps running. Closing the window only hides it. Quit is in the tray menu."
        on={autostart}
        onToggle={() => void setAutostart(!autostart)}
      />
      <Toggle
        title="Start minimized to tray"
        hint="When launched at startup, stay in the tray instead of opening the window."
        on={startMinimized}
        onToggle={() => setStartMinimized(!startMinimized)}
      />
    </>
  );
}

function MapTab() {
  const followMe = useApp((s) => s.followMe);
  const setFollowMe = useApp((s) => s.setFollowMe);
  const showPhases = useApp((s) => s.showPhases);
  const setShowPhases = useApp((s) => s.setShowPhases);
  const heat = useApp((s) => s.heat);
  const setHeat = useApp((s) => s.setHeat);
  return (
    <>
      <Toggle
        title="Follow my character"
        hint="Switch server and planet automatically when you zone, and frame the floor you walk into."
        on={followMe}
        onToggle={() => setFollowMe(!followMe)}
      />
      <Toggle
        title="Show story phases"
        hint="Class-story rooms and personal hangars. Hidden by default; turn this on if a room you expect is missing."
        on={showPhases}
        onToggle={() => setShowPhases(!showPhases)}
      />
      <Toggle title="Heatmap" hint="Where people roleplay on this server." on={heat} onToggle={() => setHeat(!heat)} />
    </>
  );
}

function PrivacyTab() {
  const backfillOn = useApp((s) => s.backfillOn);
  const setBackfill = useApp((s) => s.setBackfill);
  const bf = useApp((s) => s.backfill);
  const showSeen = useApp((s) => s.showSeen);
  const setShowSeen = useApp((s) => s.setShowSeen);
  const openModal = useApp((s) => s.openModal);
  return (
    <>
      <p className="note">
        Sharing is per character and starts Invisible: set a character to In Character or Out of Character to put it on
        the map. Others see a name, a status and a place.{" "}
        <Button
          variant="ghost"
          size="sm"
          style={{ padding: "0 4px", fontSize: 12 }}
          onClick={() => openModal({ kind: "notice" })}
        >
          Read the full notice
        </Button>
      </p>
      <Toggle
        title="Upload log history"
        hint="Upload older positions and nearby-player sightings for shared characters. Stored as gameplay history, separately from live presence."
        on={backfillOn}
        onToggle={() => setBackfill(!backfillOn)}
      >
        {(bf.running || bf.done > 0) && (
          <span className="bf-progress">
            {bf.running ? "Uploading" : "Uploaded"} {bf.done.toLocaleString()} of {bf.total.toLocaleString()} logs
            {bf.error ? `: ${bf.error}, retrying` : ""}
          </span>
        )}
      </Toggle>
      <Toggle
        title="Show players seen in my log"
        hint="Real players your combat log mentions nearby (targeting, grouping), as dashed grey pins marked “Not on Hydian”."
        on={showSeen}
        onToggle={() => setShowSeen(!showSeen)}
      />
      <div className="toggle" style={{ borderBottom: 0 }}>
        <div className="l">
          <b>Notes and journal stay on this device</b>
          <span>
            Anything marked <Private /> is stored here and nowhere else.
          </span>
        </div>
      </div>
      <div className="toggle" style={{ borderBottom: 0 }}>
        <div className="l">
          <b>Delete what this device sent</b>
          <span>
            Removes this installation and its friend connections. Uploaded gameplay samples retain time and place with
            replacement identifiers. This cannot be undone.
          </span>
        </div>
        <Button variant="destructive" size="sm" onClick={() => openModal({ kind: "offboard" })}>
          Delete…
        </Button>
      </div>
    </>
  );
}

function AboutTab() {
  const up = useApp((s) => s.uplink);
  const version = useApp((s) => s.version);
  const update = useApp((s) => s.update);
  const checkUpdate = useApp((s) => s.checkUpdate);
  const restart = useApp((s) => s.restartToUpdate);
  return (
    <>
      <div className="notice-brand">
        <Logo size={40} />
        <div className="wordmark">
          Hydian<span>Where roleplay is happening in SWTOR</span>
        </div>
      </div>
      <div className="kv">
        <span className="k">Version</span>
        <span className="v" style={{ fontFamily: "var(--font)" }}>
          Hydian {version || "…"}
          {isTauri() && (
            <>
              {" · "}
              {update.phase === "ready" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ padding: "0 4px", fontSize: 12 }}
                  onClick={() => void restart()}
                >
                  Restart to update to {update.version}
                </Button>
              ) : update.phase === "downloading" ? (
                `downloading ${update.version}`
              ) : update.phase === "available" ? (
                `${update.version} is available`
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ padding: "0 4px", fontSize: 12 }}
                  onClick={() => void checkUpdate()}
                >
                  {update.phase === "error" ? "Could not check for updates. Try again" : "Check for updates"}
                </Button>
              )}
            </>
          )}
        </span>
        <span className="k">Server</span>
        <span className="v">
          <span
            className={`link-dot ${up.status === "live" ? "live" : up.status === "error" ? "error" : up.status === "sending" ? "scanning" : ""}`}
            style={{ display: "inline-block", marginRight: 6 }}
          />
          {UPLINK_LABEL[up.status] ?? up.status}
          {up.lastError ? `: ${up.lastError}` : ""}
        </span>
        <span className="k">Hotkeys</span>
        <span className="v" style={{ fontFamily: "var(--font)" }}>
          <kbd>{MOD}+K</kbd> search · <kbd>{modShift("O")}</kbd> overlay · <kbd>{modShift("L")}</kbd> lock overlay
        </span>
      </div>
      <p className="fineprint" style={{ marginTop: 16 }}>
        Hydian is a fan project, not affiliated with Electronic Arts, BioWare, Broadsword or Lucasfilm. Star Wars: The
        Old Republic and related marks belong to their owners.
      </p>
    </>
  );
}

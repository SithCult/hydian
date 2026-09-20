// Settings: one tab per concern, Discord-style.
import { isTauri } from "../../core/fs";
import { useApp, type SettingsTab } from "../../store";
import { Private } from "../bits";
import { AboutLogo } from "../AboutLogo";
import { InstallationId } from "../InstallationId";
import { IS_MAC, MOD, modShift } from "../../core/platform";
import { PrivacyPolicyLink } from "../PrivacyPolicyLink";
import { WebsitePageLink } from "../WebsitePageLink";
import { GameLinkPanel } from "../GameLink";
import { UpdateControls } from "../UpdateControls";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

const UPLINK_LABEL: Record<string, string> = {
  off: "Off",
  idle: "Connected",
  sending: "Sending",
  live: "Live",
  error: "Error",
};

const TABS: { id: SettingsTab; label: string }[] = [
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
  disabled,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) => (
  <div className="toggle">
    <div className="l">
      <b>{title}</b>
      {hint && <span>{hint}</span>}
      {children}
    </div>
    <Switch aria-label={title} checked={on} onCheckedChange={onToggle} disabled={disabled} />
  </div>
);

export function SettingsModal({ close }: { close: () => void }) {
  const modal = useApp((s) => s.modal);
  const openModal = useApp((s) => s.openModal);
  const tab = modal?.kind === "settings" ? (modal.tab ?? "game") : "game";
  return (
    <div className="modal settings tabbed">
      <nav className="settings-nav">
        <div className="settings-title">Settings</div>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "on" : ""}
            onClick={() => openModal({ kind: "settings", tab: t.id })}
          >
            {t.label}
          </button>
        ))}
        <div className="settings-nav-foot">Esc to close</div>
      </nav>
      <div className="settings-main">
        <div className="body scroll">
          <h2>{TABS.find((t) => t.id === tab)!.label}</h2>
          {tab === "game" && <GameLinkPanel diagnostics />}
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
  const trayIconVisible = useApp((s) => s.trayIconVisible);
  const trayIconChanging = useApp((s) => s.trayIconChanging);
  const setTrayIconVisible = useApp((s) => s.setTrayIconVisible);
  return (
    <>
      <Toggle
        title="Launch at startup"
        hint={`Start Hydian when you sign in. Closing the window keeps the game link running. Quit is in the ${IS_MAC ? "Hydian" : "tray"} menu.`}
        on={autostart}
        onToggle={() => void setAutostart(!autostart)}
      />
      <Toggle
        title={IS_MAC ? "Start in background" : "Start minimized to tray"}
        hint="When launched at startup, keep the window closed until you need it."
        on={startMinimized}
        onToggle={() => setStartMinimized(!startMinimized)}
      />
      {IS_MAC && (
        <Toggle
          title="Show in menu bar"
          hint={
            isTauri()
              ? "Keep Hydian in the menu bar. You can always reopen it from the Dock."
              : "Choose whether to show the menu-bar icon in the installed app."
          }
          on={trayIconVisible}
          onToggle={() => void setTrayIconVisible(!trayIconVisible)}
          disabled={!isTauri() || trayIconChanging}
        />
      )}
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
  const openModal = useApp((s) => s.openModal);
  return (
    <>
      <p className="settings-privacy-intro">
        Characters start Invisible. In My characters, choose In Character or Out of Character to appear to other players
        while active. <PrivacyPolicyLink />
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
      <div className="toggle" style={{ borderBottom: 0 }}>
        <div className="l">
          <b>Notes and journal</b>
          <span>
            Marked <Private /> and saved only on this device.
          </span>
        </div>
      </div>
      <div className="toggle" style={{ borderBottom: 0 }}>
        <div className="l">
          <b>Delete what this device sent</b>
          <span>
            Removes this device’s shared characters and friend connections. Gameplay samples keep their time and place
            under replacement identifiers. This cannot be undone.
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
  return (
    <>
      <div className="notice-brand">
        <AboutLogo />
        <div className="wordmark">
          Hydian<span>Where roleplay is happening in SWTOR</span>
        </div>
      </div>
      <div className="kv about-kv">
        <span className="k control-label">Version</span>
        <UpdateControls />
        <span className="k control-label">Installation ID</span>
        <InstallationId key={up.installId} value={up.installId} />
        <span className="k control-label">Privacy</span>
        <div>
          <PrivacyPolicyLink />
        </div>
        <span className="k control-label">Project</span>
        <div>
          <WebsitePageLink page="about" />
        </div>
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

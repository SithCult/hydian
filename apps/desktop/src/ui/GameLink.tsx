import { useId, useState } from "react";
import { Check, ChevronRight, FolderOpen, Link2, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { gameLinkStage } from "../core/gamelink";
import { isTauri, pickFolder } from "../core/fs";
import { IS_MAC } from "../core/platform";
import { useApp } from "../store";
import combatLoggingImage from "../assets/combat-logging.png";

const STATUS = {
  checking: { title: "Looking for your game files", description: "Checking your SWTOR folders for combat logs." },
  ready: { title: "Combat logs found", description: "Hydian follows the latest log as you play. You're ready to go." },
  missing: {
    title: "Let's find your combat logs",
    description: "The folder hasn't been found yet. Enable logging in SWTOR, or choose your CombatLogs folder below.",
  },
  empty: {
    title: "Waiting for your first combat log",
    description: "The folder is ready, but there are no logs yet. Enable logging and enter combat to create one.",
  },
  permission: {
    title: "Allow access to your game files",
    description: "Hydian needs permission to read the folder containing your combat logs.",
  },
  unavailable: {
    title: "Couldn't read your game files",
    description: "Check that your CombatLogs folder is available, then try again or choose a different folder.",
  },
};

export function GameLinkBanner() {
  const link = useApp((s) => s.link);
  const modal = useApp((s) => s.modal);
  const openModal = useApp((s) => s.openModal);
  const stage = gameLinkStage(link);
  if (stage === "ready" || stage === "checking" || modal?.kind === "notice") return null;
  const needsLogs = stage === "missing" || stage === "empty";
  return (
    <aside className="game-link-banner" aria-label="Game link setup">
      <Link2 aria-hidden="true" />
      <div>
        <strong>{needsLogs ? "Connect your game" : "Game link needs attention"}</strong>
        <span>{needsLogs ? "Set up combat logging to find your characters." : STATUS[stage].description}</span>
      </div>
      <Button variant="secondary" size="xs" onClick={() => openModal({ kind: "settings", tab: "game" })}>
        {needsLogs ? "Finish setup" : "Open game link"}
        <ChevronRight aria-hidden="true" />
      </Button>
    </aside>
  );
}

export function GameLinkPanel({ diagnostics = false }: { diagnostics?: boolean }) {
  const link = useApp((s) => s.link);
  const rescan = useApp((s) => s.rescan);
  const stage = gameLinkStage(link);
  const checking = stage === "checking";
  const needsLogs = stage === "missing" || stage === "empty";
  const StatusIcon = checking ? LoaderCircle : stage === "ready" ? Check : stage === "permission" ? ShieldAlert : Link2;
  return (
    <div className="game-link-panel">
      <section className={`game-link-status ${stage}`} aria-label="Game link status" aria-busy={checking}>
        <span className="game-link-symbol">
          <StatusIcon aria-hidden="true" />
        </span>
        <div className="game-link-status-copy" role="status" aria-live="polite">
          <h3>{STATUS[stage].title}</h3>
          <p>{STATUS[stage].description}</p>
        </div>
      </section>
      {needsLogs && <CombatLoggingGuide />}
      {stage === "permission" && (
        <p className="game-link-hint">
          {IS_MAC
            ? "On your Mac, open System Settings → Privacy & Security → Files and Folders, and allow Hydian access."
            : "Check your combat-log folder's permissions and allow Hydian to read it."}{" "}
          Then check again, or choose a folder you can access below.
        </p>
      )}
      <div className="game-link-actions">
        <Button
          size="sm"
          variant={stage === "ready" ? "secondary" : "default"}
          disabled={checking}
          onClick={() => void rescan()}
        >
          {checking ? (
            <LoaderCircle className="game-link-spinner" aria-hidden="true" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          {checking ? "Checking…" : stage === "ready" ? "Check again" : "Check for logs"}
        </Button>
        <span>
          {stage === "ready"
            ? "Checked automatically while Hydian is open."
            : "You can leave SWTOR open while you check."}
        </span>
      </div>
      <GameFolderSettings disabled={checking} />
      {diagnostics && <GameLinkDiagnostics />}
    </div>
  );
}

function CombatLoggingGuide() {
  return (
    <Dialog>
      <section className="combat-logging-guide" aria-label="Enable combat logging in SWTOR">
        <ol>
          <li>
            <span>
              <b>Open Combat Logging</b>
              <span>
                In SWTOR, press <kbd>Esc</kbd> and choose Preferences → Combat Logging.
              </span>
            </span>
          </li>
          <li>
            <span>
              <b>Enable combat logging to file</b>
              <span>Tick the checkbox and choose Apply.</span>
            </span>
          </li>
          <li>
            <span>
              <b>Create your first log</b>
              <span>Play your character and enter combat, then check for logs here.</span>
            </span>
          </li>
        </ol>
        <details className="game-link-disclosure game-link-picture">
          <summary>
            See where to find it in SWTOR <ChevronRight aria-hidden="true" />
          </summary>
          <figure>
            <DialogTrigger asChild>
              <button className="game-link-image-button" aria-label="Enlarge combat logging screenshot">
                <img
                  src={combatLoggingImage}
                  alt="SWTOR Preferences with Combat Logging selected in the left menu and Enable combat logging to file checked on the right."
                  width="2234"
                  height="1178"
                />
                <span>Enlarge screenshot</span>
              </button>
            </DialogTrigger>
            <figcaption>Combat Logging is in the left menu. The logging checkbox is on the right.</figcaption>
          </figure>
        </details>
        <DialogContent className="game-link-image-dialog">
          <DialogTitle>Combat logging in SWTOR</DialogTitle>
          <img
            src={combatLoggingImage}
            alt="Select Combat Logging in Preferences, then tick Enable combat logging to file and choose Apply."
            width="2234"
            height="1178"
          />
        </DialogContent>
      </section>
    </Dialog>
  );
}

function GameFolderSettings({ disabled }: { disabled: boolean }) {
  const paths = useApp((s) => s.paths);
  const custom = useApp((s) => s.pathsCustom);
  const setPaths = useApp((s) => s.setPaths);
  const resetPaths = useApp((s) => s.resetPaths);
  const hasCustom = !!(custom.logsDir || custom.settingsDir);
  return (
    <details className="game-link-disclosure game-folder-settings">
      <summary>
        <span>
          <FolderOpen aria-hidden="true" /> Game folders
        </span>
        <span>
          {hasCustom ? "Custom" : "Automatic"}
          <ChevronRight aria-hidden="true" />
        </span>
      </summary>
      <div className="game-folder-content">
        <p>Hydian looks for your game folders automatically. Choose them here if SWTOR saves them elsewhere.</p>
        {IS_MAC && <p>For CrossOver or Whisky, use the Windows folders inside your SWTOR bottle.</p>}
        <PathField
          key={`logs:${paths?.logsDir}`}
          label="Combat logs"
          value={paths?.logsDir ?? ""}
          onSave={(logsDir) => setPaths({ logsDir })}
          disabled={disabled}
        />
        <PathField
          key={`settings:${paths?.settingsDir}`}
          label="Game settings"
          value={paths?.settingsDir ?? ""}
          onSave={(settingsDir) => setPaths({ settingsDir })}
          disabled={disabled}
        />
        {hasCustom && (
          <Button variant="ghost" size="xs" disabled={disabled} onClick={() => void resetPaths()}>
            Use automatic detection
          </Button>
        )}
      </div>
    </details>
  );
}

function PathField({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
  disabled: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const toast = useApp((s) => s.toast);
  const busy = disabled || saving;
  async function save(path: string) {
    setSaving(true);
    try {
      await onSave(path.trim());
    } catch {
      toast("Couldn't use that folder. Check the path and try again.", "warn");
    } finally {
      setSaving(false);
    }
  }
  async function browse() {
    try {
      const path = await pickFolder(`Choose the SWTOR ${label.toLowerCase()} folder`, value || undefined);
      if (path) {
        setDraft(path);
        await save(path);
      }
    } catch {
      toast("Couldn't open the folder picker. You can paste the folder path instead.", "warn");
    }
  }
  return (
    <div className="game-path-field">
      <label htmlFor={id}>{label}</label>
      <div>
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!busy && draft.trim() && draft !== value) void save(draft);
            }
          }}
          placeholder="Folder path"
          spellCheck={false}
          disabled={busy}
        />
        {draft !== value && (
          <Button variant="secondary" size="sm" disabled={busy || !draft.trim()} onClick={() => void save(draft)}>
            Use folder
          </Button>
        )}
        {isTauri() && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void browse()}>
            Browse…
          </Button>
        )}
      </div>
    </div>
  );
}

function GameLinkDiagnostics() {
  const link = useApp((s) => s.link);
  const characters = useApp((s) => s.myChars);
  const roster = useApp((s) => s.rosterList);
  const live = useApp((s) => s.live);
  const scanMs = useApp((s) => s.scanMs);
  return (
    <details className="game-link-disclosure game-link-diagnostics">
      <summary>
        Connection details <ChevronRight aria-hidden="true" />
      </summary>
      <dl>
        <div>
          <dt>Current log</dt>
          <dd>{link.file ?? "No log yet"}</dd>
        </div>
        <div>
          <dt>Characters</dt>
          <dd>
            {characters.length} in logs · {roster.length} in game settings
          </dd>
        </div>
        <div>
          <dt>Activity read</dt>
          <dd>{link.lines.toLocaleString()} lines</dd>
        </div>
        <div>
          <dt>Last scan</dt>
          <dd>{scanMs} ms</dd>
        </div>
        {live?.area && (
          <div>
            <dt>In-game area</dt>
            <dd>
              {live.area.name}
              {live.area.mode ? ` · ${live.area.mode}` : ""}
            </dd>
          </div>
        )}
        {live?.pos && (
          <div>
            <dt>Position</dt>
            <dd>
              x {live.pos.x.toFixed(1)} · y {live.pos.y.toFixed(1)} · z {live.pos.z.toFixed(1)}
            </dd>
          </div>
        )}
      </dl>
    </details>
  );
}

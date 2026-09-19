import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { planetById, planetForArea } from "../data/planets";
import { hueOf, type Player } from "../model";
import { useApp } from "../store";
import { selectMe, selectSeen } from "../selectors";
import { ProfileModal } from "./Profile";
import { SettingsModal } from "./modals/Settings";
import { OffboardModal } from "./modals/Offboard";
import { Onboarding } from "./onboarding/Onboarding";
import { CharactersModal } from "./modals/Characters";

export function Modals() {
  const modal = useApp((s) => s.modal);
  const openModal = useApp((s) => s.openModal);
  const close = () => openModal(null);
  const locked = modal?.kind === "notice"; // first run: no dismissing by click-away or Esc
  const title =
    modal?.kind === "settings"
      ? "Settings"
      : modal?.kind === "characters"
        ? "Characters"
        : modal?.kind === "offboard"
          ? "Delete what this device sent"
          : modal?.kind === "notice"
            ? "Welcome"
            : "Character";
  return (
    <Dialog open={!!modal} onOpenChange={(o) => !o && !locked && close()}>
      <DialogContent
        showCloseButton={false}
        className="app-dialog"
        onInteractOutside={(e) => locked && e.preventDefault()}
        onOpenAutoFocus={(e) => {
          // focus the dialog itself, not its first button (which would open with a focus ring)
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
        onEscapeKeyDown={(e) => locked && e.preventDefault()}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {modal?.kind === "profile" &&
          (() => {
            const p = findPlayer(modal.key);
            return p ? <ProfileModal p={p} close={close} /> : null;
          })()}
        {modal?.kind === "settings" && <SettingsModal close={close} />}
        {modal?.kind === "characters" && <CharactersModal close={close} />}
        {modal?.kind === "notice" && <Onboarding />}
        {modal?.kind === "offboard" && <OffboardModal close={close} />}
      </DialogContent>
    </Dialog>
  );
}

function findPlayer(pkey: string): Player | null {
  const s = useApp.getState();
  const me = selectMe(s);
  if (me?.key === pkey) return me;
  const lp =
    s.livePlayers[pkey] ??
    Object.values(s.registry)
      .flatMap((r) => r.players)
      .find((p) => p.key === pkey);
  if (lp) return lp;
  const sg = selectSeen(s).find((p) => p.key === pkey);
  if (sg) return sg;
  const c = s.myChars.find((c) => `${c.server}:${c.id}` === pkey);
  if (!c) {
    // a friend or someone met who is not in any list right now: name plus whatever the local history knows
    const f = s.friends[pkey];
    const met = s.met[pkey];
    if (!f && !met) return null;
    const [server, id] = pkey.split(":");
    return {
      key: pkey,
      id,
      name: f?.name ?? met!.name,
      server,
      cls: null,
      disc: null,
      planetId: met?.lastArea ?? null,
      areaName: met?.lastArea ? (planetById(met.lastArea)?.name ?? "-") : "-",
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      status: "invisible",
      hue: hueOf(id),
      lastActive: met?.last ?? 0,
      isSeen: true,
    };
  }
  const pl = planetForArea(c.area);
  return {
    key: pkey,
    id: c.id,
    name: c.name,
    server: c.server,
    cls: c.cls,
    disc: c.disc,
    planetId: pl?.id ?? null,
    areaName: c.area?.name ?? "-",
    x: c.pos?.x ?? 0,
    y: c.pos?.y ?? 0,
    z: c.pos?.z ?? 0,
    heading: 0,
    status: "invisible",
    hue: hueOf(c.id),
    lastActive: c.lastEventMs ?? c.lastSeen,
    isMe: true,
  };
}

/** Editable path with a native "Browse…" in the desktop app; plain text entry in the browser preview. */

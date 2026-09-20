import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { planetForArea } from "../data/planets";
import { DEFAULT_STATUS, isPublicPlayer, hueOf, type Player } from "../model";
import { useApp, type AppState } from "../store";
import { selectMe } from "../selectors";
import { ProfileModal } from "./Profile";
import { SettingsModal } from "./modals/Settings";
import { OffboardModal } from "./modals/Offboard";
import { Onboarding } from "./onboarding/Onboarding";
import { CharactersModal } from "./modals/Characters";

export function Modals() {
  const state = useApp();
  const modal = state.modal;
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
            const p = findPlayer(state, modal.key);
            return p ? (
              <ProfileModal p={p} close={close} />
            ) : (
              <div className="modal">
                <p>This character isn’t sharing right now.</p>
              </div>
            );
          })()}
        {modal?.kind === "settings" && <SettingsModal close={close} />}
        {modal?.kind === "characters" && <CharactersModal close={close} />}
        {modal?.kind === "notice" && <Onboarding />}
        {modal?.kind === "offboard" && <OffboardModal close={close} />}
      </DialogContent>
    </Dialog>
  );
}

function findPlayer(s: AppState, pkey: string): Player | null {
  const me = selectMe(s);
  if (me?.key === pkey) return me;
  const c = s.myChars.find((c) => `${c.server}:${c.id}` === pkey);
  if (!c) {
    const lp =
      s.livePlayers[pkey] ??
      Object.values(s.registry)
        .flatMap((r) => r.players)
        .find((p) => p.key === pkey);
    if (lp && isPublicPlayer(lp, s.clock)) return lp;
    return null;
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
    status: (s.charStatus[pkey] ?? DEFAULT_STATUS).status,
    lfrp: s.charStatus[pkey]?.lfrp,
    instance: s.charStatus[pkey]?.instance,
    hue: hueOf(c.id),
    lastActive: c.lastEventMs ?? c.lastSeen,
    isMe: true,
  };
}

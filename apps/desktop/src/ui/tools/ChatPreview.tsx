import type { ReactNode } from "react";
import { CHANNELS } from "../../core/chatcolors";

const FALLBACK_NAMES = ["Vessa", "Korrin", "Talia", "Dravek", "Mira", "Jorun", "Senna"];
const ix = (name: string) => CHANNELS.find((c) => c.name === name)!.ix;

/** A few lines of chat in the game's formats, spoken by the player's own characters where we know them. */
function lines(names: string[]): { ix: number; text: string }[] {
  const n = (i: number) => names[i % names.length];
  return [
    { ix: ix("Character login"), text: `${n(4)} has come online.` },
    { ix: ix("General"), text: `[General] ${n(5)}: Anyone heading to the cantina tonight?` },
    { ix: ix("Say"), text: `${n(0)} says: The docks are quiet. Too quiet.` },
    { ix: ix("Emote"), text: `${n(1)} leans against the bar and watches the door.` },
    { ix: ix("Whisper"), text: `${n(2)} whispers: Meet me at the landing pad.` },
    { ix: ix("Yell"), text: `${n(3)} yells: Hold the line!` },
    { ix: ix("Custom channel 1"), text: `[1. RP] ${n(6)}: A hooded figure enters the chamber.` },
    { ix: ix("Group"), text: `[Group] ${n(1)}: Ready when you are.` },
    { ix: ix("Ops"), text: `[Ops] ${n(4)}: Pull in ten seconds.` },
    { ix: ix("Guild"), text: `[Guild] ${n(5)}: The masquerade starts at nine.` },
    { ix: ix("Officer"), text: `[Officer] ${n(2)}: Invites are out.` },
    { ix: ix("Trade"), text: `[Trade] ${n(3)}: Selling a gold mirror-armor dye.` },
    { ix: ix("System feedback"), text: "You have received 250 credits." },
    { ix: ix("Error"), text: "You cannot do that while in combat." },
  ];
}

/** The chat as it will look in game. */
export function ChatPreview({ colors, names, badge }: { colors: string[]; names: string[]; badge: ReactNode }) {
  const cast = names.length >= 3 ? names : [...names, ...FALLBACK_NAMES];
  return (
    <figure className="chat-preview">
      <div className="chat-window" role="log" aria-label="Chat preview">
        {lines(cast).map((l, i) => (
          <p key={i} style={{ color: `#${colors[l.ix]}` }}>
            {l.text}
          </p>
        ))}
      </div>
      <figcaption>{badge}</figcaption>
    </figure>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "../../store";
import { Icons } from "../bits";
import { Logo } from "../Logo";
import { MapPreview, NotesPreview, OverlayPreview, RegistryPreview, StatusPreview } from "./previews";
import { Button } from "@/components/ui/button";
import { GameLinkPanel } from "../GameLink";
import { gameLinkStage } from "../../core/gamelink";

interface Tour {
  title: string;
  text: ReactNode;
  preview: ReactNode;
}

const TOUR: Tour[] = [
  {
    title: "The live map",
    text: (
      <>
        Everyone who shares their position, on the game's own maps: planets, regions and every interior floor. Your
        floor is read from the log, so "Lower Promenade" means the lower one.
      </>
    ),
    preview: <MapPreview />,
  },
  {
    title: "Your status",
    text: (
      <>
        <em>In Character</em>, <em>Out of Character</em> or <em>Invisible</em>, per character. Switch on{" "}
        <em>Looking for RP</em> and your pin sends out a beacon.
      </>
    ),
    preview: <StatusPreview />,
  },
  {
    title: "Registry & friends",
    text: (
      <>
        Everyone sharing a character on your server, where they are and when they were last around. Friend the people
        you play with; they sort to the top.
      </>
    ),
    preview: <RegistryPreview />,
  },
  {
    title: "Notes & journal",
    text: (
      <>
        Notes on the characters you meet (your in-game notes come along) and a journal for your own character's story.
        Both stay on this device.
      </>
    ),
    preview: <NotesPreview />,
  },
  {
    title: "In-game overlay",
    text: (
      <>
        A small card over the game: who is on Hydian near you, beacons, instance numbers, your floor. Lock it and play
        through it.
      </>
    ),
    preview: <OverlayPreview />,
  },
];

const ESSENTIALS = TOUR.length + 1;
const SETUP = ESSENTIALS + 1;

export function Onboarding() {
  const acknowledge = useApp((s) => s.acknowledgeNotice);
  const link = useApp((s) => s.link);
  const ready = gameLinkStage(link) === "ready";
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const pane = useRef<HTMLDivElement>(null);
  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(Math.max(0, Math.min(SETUP, to)));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("button, a, input, select, textarea, summary, [contenteditable]")) return;
      if (e.key === "ArrowRight" && step < ESSENTIALS) go(step + 1);
      else if (e.key === "ArrowLeft" && step > 0) go(step - 1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (step > 0) pane.current?.focus();
  }, [step]);

  const tour = step >= 1 && step <= TOUR.length ? TOUR[step - 1] : null;
  return (
    <div className="modal onboarding">
      <div key={step} ref={pane} tabIndex={-1} className={`ob-pane ${dir > 0 ? "from-right" : "from-left"}`}>
        {step === 0 && (
          <div className="ob-welcome">
            <div className="ob-stars" aria-hidden>
              {STARS.map(([x, y, d], i) => (
                <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
              ))}
            </div>
            <GlassLogo />
            <h1>Welcome to Hydian</h1>
            <p>Where roleplay is happening in Star Wars: The Old Republic.</p>
            <div className="ob-actions">
              <Button size="sm" onClick={() => go(1)}>
                Take the tour
              </Button>
              <Button variant="ghost" size="sm" onClick={() => go(ESSENTIALS)}>
                Skip to the essentials
              </Button>
            </div>
          </div>
        )}
        {tour && (
          <>
            <div className="ob-stage">{tour.preview}</div>
            <div className="ob-copy">
              <h2>{tour.title}</h2>
              <p>{tour.text}</p>
            </div>
          </>
        )}
        {step === ESSENTIALS && <Essentials />}
        {step === SETUP && (
          <div className="ob-game-link scroll">
            <h2>Connect to SWTOR</h2>
            <p className="ob-game-intro">Combat logs help Hydian find your characters and follow them in game.</p>
            <GameLinkPanel />
          </div>
        )}
      </div>

      {step > 0 && (
        <div className="ob-foot">
          <Button variant="ghost" size="sm" onClick={() => go(step - 1)}>
            Back
          </Button>
          <div className="ob-dots" aria-hidden>
            {Array.from({ length: SETUP }, (_, i) => (
              <i key={i} className={i + 1 === step ? "on" : i + 1 < step ? "done" : ""} />
            ))}
          </div>
          {step < ESSENTIALS ? (
            <div className="ob-actions">
              <Button variant="ghost" size="sm" onClick={() => go(ESSENTIALS)}>
                Skip
              </Button>
              <Button size="sm" onClick={() => go(step + 1)}>
                Next
              </Button>
            </div>
          ) : step === ESSENTIALS ? (
            <Button size="sm" onClick={() => (ready ? acknowledge() : go(SETUP))}>
              {ready ? "Open Hydian" : "Continue"}
            </Button>
          ) : (
            <Button variant={ready ? "default" : "ghost"} size="sm" onClick={acknowledge}>
              {ready ? "Open Hydian" : "Skip for now"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** The mark on a liquid-glass tile: layered highlights, a slow float, a passing glint. */
function GlassLogo() {
  return (
    <div className="glass-wrap">
      <div className="glass-halo" />
      <div className="glass">
        <Logo size={96} />
      </div>
    </div>
  );
}

const STARS: [number, number, number][] = [
  [8, 18, 0],
  [22, 62, 1.2],
  [31, 12, 2.1],
  [47, 70, 0.6],
  [66, 8, 1.7],
  [78, 40, 0.3],
  [90, 22, 2.6],
  [86, 76, 1.1],
  [14, 84, 2.9],
  [58, 88, 1.9],
];

function Essentials() {
  const rows: [ReactNode, string, ReactNode][] = [
    [
      Icons.book(),
      "Hydian reads two folders",
      "Combat logs for characters and encounters, and game settings for character names, friends and notes.",
    ],
    [
      Icons.eyeOff(),
      "Every character starts Invisible",
      <>
        Set one to <em>In Character</em> or <em>Out of Character</em> to publish its status and location. Gameplay
        updates and enabled log history are uploaded; friend connections can upload while you are Invisible.
      </>,
    ],
    [
      Icons.users(),
      "Only shared characters appear",
      <>
        The map and registry show active characters sharing as <em>In Character</em> or <em>Out of Character</em>.
        Invisible characters stay off these lists. Your log can include nearby players; those sightings upload while
        your character is shared.
      </>,
    ],
    [
      Icons.lock(),
      "No account",
      "Notes and journal stay on this device. Settings › Privacy explains uploads and deletion, including gameplay samples kept with replacement identifiers.",
    ],
  ];
  return (
    <div className="ob-essentials">
      <h2>Before you play</h2>
      <ul>
        {rows.map(([icon, title, text], i) => (
          <li key={i} style={{ animationDelay: `${0.08 + i * 0.07}s` }}>
            <span className="ic">{icon}</span>
            <div>
              <b>{title}</b>
              <span>{text}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

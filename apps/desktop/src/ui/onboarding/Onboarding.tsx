// First run (and again when NOTICE_VERSION bumps): a welcome, an optional tour with a live preview per feature,
// and the short "your data" page that closes with Got it. Fixed size, so nothing jumps between steps.
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "../../store";
import { Icons } from "../bits";
import { Logo } from "../Logo";
import { MapPreview, NotesPreview, OverlayPreview, RegistryPreview, StatusPreview } from "./previews";
import { Button } from "@/components/ui/button";

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

const LAST = TOUR.length + 1; // 0 = welcome, 1..n = tour, n + 1 = your data

export function Onboarding() {
  const acknowledge = useApp((s) => s.acknowledgeNotice);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(Math.max(0, Math.min(LAST, to)));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") go(step + 1);
      else if (e.key === "ArrowLeft") go(step - 1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const tour = step >= 1 && step <= TOUR.length ? TOUR[step - 1] : null;
  return (
    <div className="modal onboarding">
      <div key={step} className={`ob-pane ${dir > 0 ? "from-right" : "from-left"}`}>
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
              <Button variant="ghost" size="sm" onClick={() => go(LAST)}>
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
        {step === LAST && <Essentials />}
      </div>

      {step > 0 && (
        <div className="ob-foot">
          <Button variant="ghost" size="sm" onClick={() => go(step - 1)}>
            Back
          </Button>
          <div className="ob-dots" aria-hidden>
            {Array.from({ length: LAST }, (_, i) => (
              <i key={i} className={i + 1 === step ? "on" : i + 1 < step ? "done" : ""} />
            ))}
          </div>
          {step < LAST ? (
            <div className="ob-actions">
              <Button variant="ghost" size="sm" onClick={() => go(LAST)}>
                Skip
              </Button>
              <Button size="sm" onClick={() => go(step + 1)}>
                Next
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={acknowledge}>
              Got it
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
      "The combat log the game writes, and the settings folder for character names.",
    ],
    [
      Icons.eyeOff(),
      "Every character starts Invisible",
      <>
        Set one to <em>In Character</em> or <em>Out of Character</em> and its name, server, planet, position and status
        are shared while you play, plus its older positions from your logs.
      </>,
    ],
    [
      Icons.users(),
      "Players near you show up too",
      <>
        When your log mentions someone, their name and position are shared as well. They appear as{" "}
        <em>Not on Hydian</em>: a name and a last-seen.
      </>,
    ],
    [
      Icons.lock(),
      "No account",
      "Others see a name, a status and a place. Notes and journal stay on this device. Settings › Privacy deletes what this device sent.",
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

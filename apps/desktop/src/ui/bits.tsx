import { type CSSProperties, type ReactNode } from "react";
import { STATUS_META, type RPStatus } from "../model";

import { assetUrl, planetIcon } from "../data/maps";
import { placeKind } from "../data/places";
import { planetById } from "../data/planets";
import { Tip } from "./Tip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function PlanetIcon({
  slug,
  size = 20,
  faction,
  className,
}: {
  slug: string;
  size?: number;
  faction?: "imp" | "rep";
  className?: string;
}) {
  const src = planetIcon(slug);
  if (!src) return <span className={`dot ${className ?? ""}`} />;
  const img = (
    <img
      className={`picon ${className ?? ""}`}
      src={src}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{ width: size, height: size }}
    />
  );
  if (!faction) return img;
  const b = Math.max(11, Math.round(size * 0.55));
  return (
    <span className="picon-wrap" style={{ width: size, height: size }}>
      {img}
      <img
        className={`femblem ${faction}`}
        src={assetUrl(`icons/faction/${faction}.webp`)}
        width={b}
        height={b}
        alt={faction === "imp" ? "Imperial" : "Republic"}
        draggable={false}
        style={{ width: b, height: b }}
      />
    </span>
  );
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function Avatar({
  p,
  size,
  status,
  bg,
  ghost,
}: {
  p: { name: string; hue: number };
  size?: "sm" | "lg";
  status?: RPStatus;
  bg?: string;
  ghost?: boolean;
}) {
  const style = { "--h": p.hue, "--sc": status ? STATUS_META[status].color : undefined, "--sb": bg } as CSSProperties;
  return (
    <div className={`avatar ${size ?? ""} ${ghost ? "ghost" : ""}`} style={style}>
      {initials(p.name)}
      {status && <span className="sd" />}
    </div>
  );
}

export const ago = (t: number) => {
  if (!t) return "never";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

// ------------------------------------------------------------------ icons
const I = ({ d, ...rest }: { d: string } & React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    <path d={d} />
  </svg>
);
export const Icons = {
  search: (p?: React.SVGProps<SVGSVGElement>) => <I d="M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" {...p} />,
  gear: (p?: React.SVGProps<SVGSVGElement>) => (
    <I
      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
      {...p}
    />
  ),
  chevron: (p?: React.SVGProps<SVGSVGElement>) => <I d="M6 9l6 6 6-6" {...p} />,
  map: (p?: React.SVGProps<SVGSVGElement>) => <I d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16" {...p} />,
  users: (p?: React.SVGProps<SVGSVGElement>) => (
    <I
      d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"
      {...p}
    />
  ),
  x: (p?: React.SVGProps<SVGSVGElement>) => <I d="M18 6L6 18M6 6l12 12" {...p} />,
  fit: (p?: React.SVGProps<SVGSVGElement>) => (
    <I d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" {...p} />
  ),
  swap: (p?: React.SVGProps<SVGSVGElement>) => (
    <I d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" {...p} />
  ),
  /** crosshair: jump the view to my character */
  locate: (p?: React.SVGProps<SVGSVGElement>) => (
    <I
      d="M12 2v3M12 19v3M2 12h3M19 12h3M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
      {...p}
    />
  ),
  flame: (p?: React.SVGProps<SVGSVGElement>) => (
    <I
      d="M12 22c4.4 0 7-2.9 7-6.5 0-3.2-2-5.3-3.5-7-.4 1.6-1.3 2.7-2.5 3.2.3-3-1-6.3-4-8.7.2 3.2-1.4 4.6-3 6.4C4.7 11 5 12.9 5 15.5 5 19.1 7.6 22 12 22z"
      {...p}
    />
  ),
  ship: (p?: React.SVGProps<SVGSVGElement>) => (
    <I d="M12 2c2.5 2.5 3.5 6 3.5 10l2.5 3v3l-3-1.5-1 2.5h-4l-1-2.5L6 18v-3l2.5-3C8.5 8 9.5 4.5 12 2zM12 9v3" {...p} />
  ),
  home: (p?: React.SVGProps<SVGSVGElement>) => <I d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" {...p} />,
  pin: (p?: React.SVGProps<SVGSVGElement>) => (
    <I d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" {...p} />
  ),
  // friends: a heart. Outline as the marker next to a name, filled once you are friends, with a plus to add.
  friend: (p?: React.SVGProps<SVGSVGElement>) => (
    <I d="M12 20.5s-7.5-4.6-9.4-9.2A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 9.4 4.7c-1.9 4.6-9.4 9.2-9.4 9.2z" {...p} />
  ),
  friendOn: (p?: React.SVGProps<SVGSVGElement>) => (
    <I
      d="M12 20.5s-7.5-4.6-9.4-9.2A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 9.4 4.7c-1.9 4.6-9.4 9.2-9.4 9.2z"
      fill="currentColor"
      {...p}
    />
  ),
  friendAdd: (p?: React.SVGProps<SVGSVGElement>) => (
    <I
      d="M12 20.5s-7.5-4.6-9.4-9.2A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 9.4 4.7c-1.9 4.6-9.4 9.2-9.4 9.2zM12 10v5M9.5 12.5h5"
      {...p}
    />
  ),
  clock: (p?: React.SVGProps<SVGSVGElement>) => <I d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2" {...p} />,
  trash: (p?: React.SVGProps<SVGSVGElement>) => (
    <I
      d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"
      {...p}
    />
  ),
  lock: (p?: React.SVGProps<SVGSVGElement>) => (
    <I d="M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4" {...p} />
  ),
  help: (p?: React.SVGProps<SVGSVGElement>) => (
    <I d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" {...p} />
  ),
  book: (p?: React.SVGProps<SVGSVGElement>) => (
    <I d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" {...p} />
  ),
  sort: (p?: React.SVGProps<SVGSVGElement>) => <I d="M3 6h18M6 12h12M10 18h4" {...p} />,
  star: (p?: React.SVGProps<SVGSVGElement>) => (
    <I d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" {...p} />
  ),
  /** navigation arrow: keep following my character */
  follow: (p?: React.SVGProps<SVGSVGElement>) => <I d="M3 11l18-8-8 18-2-8-8-2z" {...p} />,
  eyeOff: (p?: React.SVGProps<SVGSVGElement>) => (
    <I
      d="M17.9 17.9A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.1-6M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"
      {...p}
    />
  ),
};

/** The faction emblem on its own, for a name or a chip. */
export function FactionMark({ faction, size = 14 }: { faction: "imp" | "rep"; size?: number }) {
  return (
    <img
      className={`fmark ${faction}`}
      src={assetUrl(`icons/faction/${faction}.webp`)}
      width={size}
      height={size}
      alt={faction === "imp" ? "Empire" : "Republic"}
      draggable={false}
      style={{ width: size, height: size }}
    />
  );
}

/** An icon for where someone is: the planet's own, or a placeholder for ships, strongholds and the rest. */
export function PlaceIcon({
  areaId,
  areaName,
  size = 18,
}: {
  areaId: string | null | undefined;
  areaName: string | null | undefined;
  size?: number;
}) {
  const planet = areaId ? planetById(areaId) : undefined;
  if (planet) return <PlanetIcon slug={planet.slug} size={size} faction={planet.faction} />;
  const kind = placeKind(areaId, areaName);
  const glyph = kind === "ship" ? Icons.ship : kind === "stronghold" ? Icons.home : Icons.pin;
  return (
    <span className={`place-icon ${kind}`} style={{ width: size, height: size }}>
      {glyph({ width: Math.round(size * 0.6), height: Math.round(size * 0.6) })}
    </span>
  );
}

/** The one badge for "stored on this device": same icon, same word, everywhere. */
export function Private({ what }: { what?: string }) {
  return (
    <Tip label={`${what ?? "This"} is stored on this device only.`}>
      <span className="private">{Icons.lock({ width: 11, height: 11 })}Private</span>
    </Tip>
  );
}

/** "?" next to a rich-text editor: how to use it. */
export function EditorHelp({ note }: { note?: ReactNode }) {
  return (
    <Popover>
      <Tip label="How to write here">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            {Icons.help({ width: 15, height: 15 })}
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent side="bottom" align="end" className="pop ed-help-pop w-[330px]">
        <div className="sect">Writing</div>
        <div className="ed-help-row">
          <kbd>/</kbd>
          <span>Insert a block: heading, list, checklist, quote, table, image…</span>
        </div>
        <div className="ed-help-row">
          <kbd>#</kbd>
          <span>
            <kbd>#</kbd>, <kbd>##</kbd>, <kbd>-</kbd>, <kbd>1.</kbd>, <kbd>&gt;</kbd>, <kbd>[]</kbd> at the start of a
            line, then space
          </span>
        </div>
        <div className="ed-help-row">
          <kbd>⋮⋮</kbd>
          <span>Hover a block for its handle: drag to move, click for colours and more</span>
        </div>
        <div className="ed-help-row">
          <kbd>Ctrl</kbd>
          <span>
            Select text for bold, italic, links and colours; <kbd>Ctrl</kbd>+<kbd>B</kbd>/<kbd>I</kbd>/<kbd>U</kbd> work
            too
          </span>
        </div>
        <div className="ed-help-row">
          <kbd>Tab</kbd>
          <span>
            Nest a block under the one above; <kbd>Shift</kbd>+<kbd>Tab</kbd> to un-nest
          </span>
        </div>
        <div className="ed-help-foot">
          Saves as you type.
          {note && <div className="ed-help-note">{note}</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Discord-style dismissal for click-opened menus: they stay open while the pointer wanders, and close on a
 * click anywhere outside the container or on Escape.
 */

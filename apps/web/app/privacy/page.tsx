import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import s from "../page.module.css";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Hydian reads, what it sends, where it is stored and how to delete it.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <main className={s.page}>
      <Reveal>
        <p className="hud">Privacy</p>
        <h1>What Hydian reads, sends and keeps.</h1>
        <p className={s.lead}>
          Hydian has no accounts. Everything below is tied to a random install id the app makes on first start, not to
          you.
        </p>
      </Reveal>
      <Reveal delay={0.1} className={s.prose}>
        <h2>The app</h2>
        <h3>What it reads on your computer</h3>
        <ul>
          <li>The combat log files the game writes, to find your character, the area you are in and your position.</li>
          <li>The game settings folder, for the names of your characters.</li>
        </ul>
        <p>That is all. Hydian does not read the game process, its memory or any other file.</p>

        <h3>What it sends</h3>
        <p>
          Every character starts Invisible. Nothing about a character leaves your computer until you set it to In
          character or Out of character. For a shared character the app sends:
        </p>
        <ul>
          <li>Character name, character id, class and discipline, game server.</li>
          <li>Area, instance, position and heading, and the moment the log recorded them.</li>
          <li>Your status (In character, Out of character), whether you are looking for roleplay, and health.</li>
          <li>The log line the event came from, so a bad reading can be traced.</li>
          <li>The random install id and the app version.</li>
        </ul>
        <p>
          The app also sends sightings: names, ids and positions of players your combat log mentioned near a shared
          character. They are kept for statistics and shown to nobody; the "Not on Hydian" pins on your own map come
          from your own log, on your computer.
        </p>
        <p>
          With Upload log history switched on in Settings › Privacy, the app sends the same fields from older combat
          logs on this device for the characters you share. History only feeds the heatmap; it never shows anyone as
          present.
        </p>
        <p>
          Friend connections (which characters you follow) and the optional feedback form are sent with the install id.
        </p>

        <h3>What others see</h3>
        <p>
          A shared character appears on the map and in the registry with name, area, position, status and
          looking-for-roleplay flag, and stays present for 45 minutes after the last event. Nobody sees your class, your
          health, your install id, your log lines, your friends or your notes.
        </p>

        <h3>What stays on your computer</h3>
        <ul>
          <li>Invisible characters, in full.</li>
          <li>Your journal, notes on people, and friends list.</li>
          <li>Settings, hotkeys and the overlay layout.</li>
        </ul>

        <h3>Where it is stored and for how long</h3>
        <p>
          The Hydian server runs on Railway in the European Union (europe-west4). Live presence expires after 45
          minutes. Positions are kept so the heatmap and the activity statistics have history.
        </p>
        <p>
          Railway keeps ordinary request logs for its own operation, which include IP addresses. Hydian stores no IP
          addresses of its own.
        </p>

        <h3>Deleting</h3>
        <p>
          Settings › Privacy › Delete what this device sent removes your characters from the registry and the live map,
          deletes your friend connections and the install id, and replaces the name and log lines on every position this
          device sent with anonymous placeholders. Positions remain in the heatmap without a name.
        </p>
        <p>Setting a character back to Invisible removes it from the map and the registry right away.</p>

        <h2>The website</h2>
        <ul>
          <li>No cookies, no analytics, no tracking.</li>
          <li>Your Republic or Empire choice is kept in your browser&apos;s local storage and never sent anywhere.</li>
          <li>
            The download page loads the version number and the installers from dl.hydian.org, which Cloudflare serves.
          </li>
          <li>The site is served by Cloudflare, which keeps its own request logs.</li>
        </ul>

        <h2>Questions</h2>
        <p>
          <a href="mailto:legal@hydian.org">legal@hydian.org</a>
        </p>
        <p className={s.updated}>Last updated 18 September 2026.</p>
      </Reveal>
    </main>
  );
}

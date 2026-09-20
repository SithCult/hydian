import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import s from "../page.module.css";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Hydian uses gameplay information and the choices available to you.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <main className={s.page}>
      <Reveal>
        <p className="hud">Privacy</p>
        <h1>Privacy policy</h1>
        <p className={s.lead}>
          Hydian is a fully non-profit, fan-made project. We give privacy the same care and attention as the rest of the
          service.
        </p>
        <p className={s.lead}>
          Hydian uses SWTOR gameplay information to provide its map, character registry and social features. This policy
          explains how that information is used and the choices available to you.
        </p>
      </Reveal>
      <Reveal delay={0.1} className={s.prose}>
        <h2>Information we use</h2>
        <p>
          Hydian reads SWTOR combat logs and settings to identify characters, in-game activity, locations and friend
          connections. Gameplay information may include character names and IDs, server, class, discipline, status,
          Looking for RP, position, health, timestamps and the relevant combat-log entries. Sightings include nearby
          characters and the character observing them. They may include other players, regardless of whether they use
          Hydian.
        </p>
        <p>
          A random installation identifier associates submissions with your copy of the app. Submissions also include
          the app version. Optional feedback includes the reasons, rating and comment you choose to provide.
        </p>
        <p>
          Your journal, personal notes, local friend list, settings and encounter index are stored on your device.
          Following a character or importing a friend shares that character&apos;s ID and server with Hydian, linked to
          your installation. The overlay checks whether SWTOR is running.
        </p>
        <p>
          Using the website or app involves ordinary connection information, including IP addresses. Service logs may
          include request details and timestamps to support operation and troubleshooting.
        </p>

        <h2>How information is used</h2>
        <p>
          Gameplay information supports the live map, character registry, friend features and activity summaries. It is
          also used for service analysis and understanding gameplay behavior. Relevant combat-log entries help check how
          game events are interpreted. Feedback helps improve the app, and service administration includes reviewing
          submitted records to maintain reliability and investigate issues.
        </p>
        <p>
          At startup, the app loads the registry, map and artwork, and checks for updates. These connections and friend
          features operate independently of your character&apos;s public visibility. Previously selected sharing
          preferences resume when you reopen the app, including pending uploads.
        </p>
        <p>
          <strong>Upload log history</strong> is enabled by default for characters you share. It contributes sampled
          earlier positions and sightings from logs on your device to the recorded gameplay history. Public heatmap and
          activity summaries use live In-Character updates, separately from historical uploads and sightings.
        </p>

        <h2>Character visibility</h2>
        <p>
          Each character starts <strong>Invisible</strong>. Selecting <strong>In Character</strong> or{" "}
          <strong>Out of Character</strong> enables regular gameplay updates and sightings. Returning to Invisible sends
          a final status update; once received, it removes the character from the public map and registry. Visibility
          changes depend on an available connection and do not delete previously submitted records.
        </p>
        <p>
          Shared profiles show character name, ID, server, faction, area, status, Looking for RP, instance and last
          activity. Only active characters set to In Character or Out of Character appear in the public map and
          registry. Live presence expires around 45 minutes after the last recorded activity, and the character is then
          removed from those public lists. Your own character controls remain available privately in the app.
        </p>
        <p>
          Public heatmaps and activity summaries use a minimum of ten distinct In-Character characters for the selected
          area or server and period. Records in other players&apos; game logs are separate from Hydian&apos;s visibility
          settings.
        </p>

        <h2>Storage and service providers</h2>
        <p>
          Railway hosts gameplay records and artwork. Cloudflare delivers the website and downloads. These providers
          process connection information and operational logs as part of providing their services.
        </p>
        <p>
          Submitted gameplay records and registry history are kept as an ongoing history. Live presence follows the
          expiry described above. Local notes and journal entries remain on your device until you remove them.
        </p>

        <h2>Your choices and deletion</h2>
        <p>
          You can change each character&apos;s visibility and disable log-history uploads in the app. Friend connections
          can be submitted while your characters are Invisible.
        </p>
        <p>
          <strong>Remove from Hydian</strong> in your character&apos;s profile stops sharing from this device and
          removes its shared profile, submitted location updates, related sightings and friend connection. Your local
          game logs, notes and journal remain available. A removal record prevents pending uploads from restoring the
          character; choosing In Character or Out of Character again explicitly resumes sharing. Submissions from other
          installations are handled separately.
        </p>
        <p>
          <strong>Settings › Privacy › Delete what this device sent</strong> stops sharing and removes the installation
          record, its friend connections and character profiles currently associated with it. Names, class, discipline
          and source log entries are removed from its submitted gameplay records, character and installation identifiers
          are replaced, and observing-character details are cleared from its sightings.
        </p>
        <p>
          Gameplay samples retain their in-game time, place and other event values under replacement identifiers.
          Feedback is kept with its installation link removed. A record of the erased installation prevents delayed
          uploads from restoring its data. Submissions from other installations are handled separately. If you choose to
          share again after successful deletion, the app uses a new installation identifier.
        </p>

        <h2>Website preferences</h2>
        <p>Your Republic or Empire preference is saved in your browser so the website can remember your selection.</p>

        <h2>Contact</h2>
        <p>
          Hydian is a fan project by{" "}
          <a href="https://github.com/SithCult" target="_blank" rel="noopener noreferrer">
            SithCult
          </a>
          . For privacy questions or requests for access, correction, erasure, restriction or a copy of your
          information, contact <a href="mailto:legal@hydian.org">legal@hydian.org</a>.
        </p>
        <p>
          We handle requests individually. Include the relevant game server, character and a description of the issue so
          we can discuss how to help. Combat logs can be edited, so they cannot establish that a character belongs to
          someone. Keep your installation identifier private. You can also contact your local data protection authority
          about how your information is handled.
        </p>
        <p className={s.updated}>Last updated 20 September 2026.</p>
      </Reveal>
    </main>
  );
}

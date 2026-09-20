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
        <p className={s.lead}>Hydian is a fully non-profit, fan-made project, but we take your privacy seriously.</p>
        <p className={s.lead}>
          Hydian uses SWTOR gameplay information to provide its map, character registry and social features. This policy
          explains how that information is used and the choices available to you.
        </p>
      </Reveal>
      <Reveal delay={0.1} className={s.prose}>
        <h2>Using Hydian</h2>
        <p>
          This notice covers the Hydian app and website, a fan project by{" "}
          <a href="https://github.com/SithCult" target="_blank" rel="noopener noreferrer">
            SithCult
          </a>
          . You can use Hydian without creating an account or providing a real name or email address. A random
          installation identifier connects submissions and privacy controls to your copy of the app.
        </p>

        <h2>What stays on your device</h2>
        <p>
          Hydian reads your SWTOR combat logs and settings to recognise characters, locations and game activity. Your
          journal, personal notes, local friend list, app settings and encounter index are stored on your device. The
          overlay checks locally whether SWTOR is running.
        </p>
        <p>
          The website saves your Republic or Empire preference in your browser. You can clear this preference through
          your browser&apos;s site-data settings.
        </p>

        <h2>Information shared with Hydian</h2>
        <p>
          When you share a character, gameplay updates can include its name and game ID, server, class, discipline,
          status, Looking for RP, in-game position, health, instance, timestamps and relevant combat-log entries.
          Sightings recorded in those logs can include other players&apos; character names, game IDs and positions,
          together with the observing character. This can include players who use other settings or do not use Hydian.
        </p>
        <p>
          Following a character or importing a friend sends that character&apos;s game ID and server, linked to your
          installation. This is separate from your own character&apos;s visibility, so friend connections can be
          submitted while your characters are Invisible.
        </p>
        <p>
          Submissions include your installation identifier and app version. If you choose to send feedback, Hydian
          receives the reasons, rating and comment you provide. If you contact us by email, we receive your address and
          message so we can respond.
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
          The app connects to Hydian to display the map and player information and to check for updates. These features
          work while your character is Invisible. Your sharing preferences are remembered when you reopen the app.
          Updates waiting for a connection can be sent later while sharing remains enabled.
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
          a final status update; once received, it removes the character from the public map, player lists and overlay.
          Your own character controls remain available privately. Visibility changes take effect online when Hydian
          receives them; stored records are handled through the removal choices below.
        </p>
        <p>
          Public character information includes name, game ID, server, faction, area, in-game position, status, Looking
          for RP, instance and last activity. Only active characters set to In Character or Out of Character appear in
          these public views. A sighting in another player&apos;s log does not make a character publicly visible.
        </p>
        <p>
          Public heatmaps and activity summaries group activity by place or time. Detailed results are shown once at
          least ten distinct In-Character characters have contributed to the selected area or server and period.
          Individual names and game IDs are kept out of these summaries. Records in other players&apos; game logs are
          separate from Hydian&apos;s visibility settings.
        </p>

        <h2>How long information is kept</h2>
        <ul>
          <li>
            <strong>Live visibility:</strong> a character leaves public views after around 45 minutes without recorded
            activity, or when Hydian receives an Invisible status or removal request.
          </li>
          <li>
            <strong>Gameplay history:</strong> submitted updates, sightings, character records and friend connections
            are kept as an ongoing history for the features and analysis described above. This history remains after
            live visibility expires and is subject to the removal choices below.
          </li>
          <li>
            <strong>Feedback:</strong> submissions are kept for service improvement. Device-wide deletion removes their
            installation link while retaining the feedback itself.
          </li>
          <li>
            <strong>Removal preferences:</strong> a record of a removal is kept to prevent delayed uploads from
            restoring it. A character&apos;s removal preference is cleared when you explicitly resume sharing it.
          </li>
          <li>
            <strong>Local information:</strong> notes, journal entries and preferences remain in your device&apos;s app
            or browser storage until you remove them or clear that storage.
          </li>
          <li>
            <strong>Service logs:</strong> connection and operational logs follow the retention settings of our hosting
            providers, separately from gameplay history.
          </li>
        </ul>

        <h2>Hosting and service providers</h2>
        <p>
          Railway hosts the service, gameplay records and map artwork. Cloudflare delivers the website and app
          downloads. They process the information needed to host, deliver and protect those services, including
          connection information and operational logs.
        </p>
        <p>
          These providers operate internationally and may process information outside your country. Their privacy
          notices explain their handling of information and international-transfer safeguards:{" "}
          <a href="https://railway.com/legal/privacy" target="_blank" rel="noopener noreferrer">
            Railway
          </a>{" "}
          and{" "}
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">
            Cloudflare
          </a>
          .
        </p>

        <h2>Your choices and deletion</h2>
        <p>
          Choose <strong>Invisible</strong> to stop a character&apos;s regular gameplay updates and hide it from other
          players. Turn off <strong>Upload log history</strong> to stop contributing earlier gameplay history. These
          settings control future sharing; use the options below to remove records already submitted.
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
          Gameplay samples retain their in-game time, place and other event values under replacement identifiers for
          service analysis. Feedback is kept with its installation link removed. A record of the erased installation
          prevents delayed uploads from restoring its data. Submissions from other installations are handled separately.
          If you choose to share again after successful deletion, the app uses a new installation identifier.
        </p>

        <h2>Questions and privacy requests</h2>
        <p>
          For privacy questions or to request access, correction, deletion, restriction or a copy of information
          relating to you, contact <a href="mailto:legal@hydian.org">legal@hydian.org</a>. You can also contact us to
          object to a use of your information. These rights apply as provided by the data protection law relevant to
          your request.
        </p>
        <p>
          We handle requests on a personal basis. Include the relevant game server, character and what you would like us
          to help with. The app&apos;s privacy controls work with records sent by your installation; for other
          situations, we will work through the request with you individually. Keep your installation identifier private.
          You can also raise a concern with your local data protection authority.
        </p>
        <h2>Updates to this notice</h2>
        <p>
          We update this page as Hydian&apos;s features and data handling change. The date below identifies the current
          version.
        </p>
        <p className={s.updated}>Last updated 20 September 2026.</p>
      </Reveal>
    </main>
  );
}

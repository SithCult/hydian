// "Delete what this device sent": an optional why + rating, a last chance to stay, then the request.
import { useState } from "react";
import { useApp } from "../../store";
import { Button } from "@/components/ui/button";

const LEAVE_REASONS = [
  ["quiet", "Not enough people on my server"],
  ["privacy", "I'm not comfortable sharing my position"],
  ["setup", "It did not work with my game setup"],
  ["overlay", "The map or overlay was not useful to me"],
  ["testing", "I was only trying it out"],
  ["reinstall", "Switching machines or reinstalling"],
  ["other", "Something else"],
] as const;

/**
 * Offboarding: an honest exit. Step 1 asks why (optional) and offers to stay; step 2 spells out what goes and
 * asks for a typed confirmation; step 3 reports what the server actually did. Feedback is optional and never
 * blocks deletion.
 */
export function OffboardModal({ close }: { close: () => void }) {
  const deleteMyData = useApp((s) => s.deleteMyData);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reasons, setReasons] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ characters: number; pings: number; sightings: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toggle = (id: string) => setReasons((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await deleteMyData({ reasons, rating, comment }));
      setStep(3);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal settings offboard">
      <div className="body scroll">
        {step === 1 && (
          <>
            <h2>Before you go</h2>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>
              You can remove this installation and its links to uploaded gameplay. The gameplay samples remain without
              their original names and identifiers. Your feedback below is optional.
            </div>
            <div className="ob-section">What is the reason?</div>
            <div className="ob-reasons">
              {LEAVE_REASONS.map(([id, label]) => (
                <button key={id} className={`opt ${reasons.includes(id) ? "on" : ""}`} onClick={() => toggle(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="ob-section">How was Hydian?</div>
            <div className="ob-rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={rating != null && n <= rating ? "on" : ""}
                  onClick={() => setRating(rating === n ? null : n)}
                  aria-label={`${n} of 5`}
                >
                  ★
                </button>
              ))}
              <span>{rating ? ["", "Poor", "Meh", "Okay", "Good", "Great"][rating] : "no rating"}</span>
            </div>
            <div className="ob-section">
              Anything you want to tell us? <span className="ob-opt">optional</span>
            </div>
            <textarea
              className="ob-comment"
              maxLength={1000}
              rows={3}
              placeholder="What was missing, what broke, what you liked…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </>
        )}
        {step === 2 && (
          <>
            <h2>Delete what this device sent</h2>
            <p className="ob-lead">
              This device stops sharing. Character entries currently shared from it leave the map and registry, and its
              friend connections are removed. Uploaded gameplay keeps its time and place under replacement identifiers.
              Notes and journal stay here. This cannot be undone.
            </p>
            <div className="ob-gate">
              <span className="ob-section">
                Type <code>DELETE</code> to confirm
              </span>
              <input
                className="ob-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="DELETE"
                spellCheck={false}
                autoFocus
              />
            </div>
            {error && (
              <p className="note" style={{ borderColor: "var(--danger)", marginTop: 12 }}>
                Could not confirm deletion: {error}. Sharing is off and queued uploads have been cleared. Try again to
                confirm removal.
              </p>
            )}
          </>
        )}
        {step === 3 && result && (
          <>
            <h2>Done</h2>
            <p className="ob-lead">
              {result.characters} character{result.characters === 1 ? "" : "s"} removed, {result.pings.toLocaleString()}{" "}
              gameplay samples kept with replacement identifiers. Every character here is Invisible again and sharing is
              off. Choose In Character or Out of Character to share one again.
            </p>
          </>
        )}
      </div>
      <div className="foot">
        {step === 1 && (
          <>
            <Button size="sm" onClick={close}>
              Keep my data
            </Button>
            <span style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
              Continue
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              Back
            </Button>
            <span style={{ flex: 1 }} />
            <Button variant="secondary" size="sm" onClick={close}>
              Keep my data
            </Button>
            <Button variant="destructive" size="sm" disabled={typed !== "DELETE" || busy} onClick={() => void run()}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </>
        )}
        {step === 3 && (
          <>
            <span style={{ flex: 1 }} />
            <Button size="sm" onClick={close}>
              Close
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** First run: one screen, plain words, no legalese. Shown again only when NOTICE_VERSION changes. */

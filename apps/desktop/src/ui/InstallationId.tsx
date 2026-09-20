import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Button } from "@/components/ui/button";
import { isTauri } from "../core/fs";

export function InstallationId({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

  useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    setStatus("copying");
    try {
      if (isTauri()) await writeText(value);
      else await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="installation-id">
      <div className="installation-id-row">
        <div className="installation-id-field">
          <input
            aria-label="Installation ID"
            type={revealed ? "text" : "password"}
            value={value}
            readOnly
            autoComplete="off"
            spellCheck={false}
            placeholder="Not available yet"
          />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={revealed ? "Hide installation ID" : "Show installation ID"}
            title={revealed ? "Hide installation ID" : "Show installation ID"}
            aria-pressed={revealed}
            disabled={!value}
            onClick={() => setRevealed(!revealed)}
          >
            {revealed ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        <Button
          variant="secondary"
          size="xs"
          className="installation-id-copy"
          disabled={!value || status === "copying"}
          onClick={() => void copy()}
        >
          {status === "copied" ? <Check /> : <Copy />}
          {status === "copied" ? "Copied" : status === "copying" ? "Copying…" : "Copy"}
        </Button>
      </div>
      <p className={status === "error" ? "installation-id-feedback" : "sr-only"} role="status">
        {status === "error"
          ? "Couldn’t copy. Show the ID to copy it manually."
          : status === "copied"
            ? "Copied to clipboard."
            : ""}
      </p>
    </div>
  );
}

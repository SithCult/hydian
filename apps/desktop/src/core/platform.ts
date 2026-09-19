// Which OS the WebView runs on. The user agent is the one signal available synchronously in both the
// packaged app and the browser preview.
export const IS_MAC = /Macintosh/.test(navigator.userAgent);
export const OS: "mac" | "linux" | "windows" = IS_MAC
  ? "mac"
  : /Linux|X11/.test(navigator.userAgent)
    ? "linux"
    : "windows";

/** Path separator of the OS the app runs on (log folders are native paths, also inside a CrossOver bottle). */
export const SEP = OS === "windows" ? "\\" : "/";

/** The primary modifier as people read it on this OS: "Ctrl" or "⌘". */
export const MOD = IS_MAC ? "⌘" : "Ctrl";
/** "Ctrl+Shift+O" / "⌘⇧O": the label for a CommandOrControl+Shift+<key> shortcut. */
export const modShift = (key: string) => (IS_MAC ? `⌘⇧${key}` : `Ctrl+Shift+${key}`);

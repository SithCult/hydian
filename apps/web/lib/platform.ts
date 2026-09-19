"use client";

import { useSyncExternalStore } from "react";

export type DesktopOs = "windows" | "mac";

const subscribe = () => () => {};
const detect = (): DesktopOs => (/Macintosh|Mac OS X/.test(navigator.userAgent) ? "mac" : "windows");
const serverSnapshot = (): DesktopOs => "windows";

export function useDesktopOs(): DesktopOs {
  return useSyncExternalStore(subscribe, detect, serverSnapshot);
}

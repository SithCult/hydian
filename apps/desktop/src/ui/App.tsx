import { useEffect } from "react";
import { planetBySlug } from "../data/planets";
import { useApp } from "../store";
import { Icons, PlanetIcon } from "./bits";
import { MapView } from "./MapView";
import { Members } from "./Members";
import { Modals } from "./Modals";
import { Registry } from "./Registry";
import { Journal } from "./Journal";
import { ServerRail } from "./ServerRail";
import { Sidebar } from "./Sidebar";
import { Boundary } from "./Boundary";
import { UpdateBar } from "./UpdateBar";
import { MOD } from "../core/platform";
import { isTauri } from "../core/fs";
import { handleHelpAction } from "../core/help";
import { Tip } from "./Tip";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

export function App() {
  const boot = useApp((s) => s.boot);
  const tick = useApp((s) => s.tick);
  const view = useApp((s) => s.view);
  const slug = useApp((s) => s.planet);
  const membersOpen = useApp((s) => s.membersOpen);
  const toggleMembers = useApp((s) => s.toggleMembers);
  const search = useApp((s) => s.search);
  const setSearch = useApp((s) => s.setSearch);
  const planet = planetBySlug(slug);

  useEffect(() => {
    void boot();
  }, [boot]);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const unlisten: (() => void)[] = [];
    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        for (const [event, onEvent] of [
          ["help:action", (action: string) => void handleHelpAction(action)],
          ["tray:hide", () => void useApp.getState().setTrayIconVisible(false)],
        ] as const) {
          const stop = await listen<string>(event, ({ payload }) => onEvent(payload));
          if (disposed) stop();
          else unlisten.push(stop);
        }
      })
      .catch(() => useApp.getState().toast("Menu actions are unavailable. Use Settings or restart Hydian.", "warn"));
    return () => {
      disposed = true;
      unlisten.forEach((stop) => stop());
    };
  }, []);
  useEffect(() => {
    const id = setInterval(() => tick(Date.now()), 5000);
    return () => clearInterval(id);
  }, [tick]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const el = document.activeElement as HTMLElement | null;
        if (el?.tagName === "INPUT") {
          (el as HTMLInputElement).blur();
          if (el.id === "top-search") useApp.getState().setSearch("");
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        (document.getElementById("top-search") as HTMLInputElement)?.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <ServerRail />
      <Sidebar />
      <main className="main">
        <UpdateBar />
        <header className="topbar" data-tauri-drag-region>
          <h1>
            {view === "map" && planet && <PlanetIcon slug={planet.slug} size={26} faction={planet.faction} />}
            {view === "map" ? planet?.name : view === "registry" ? "Registry" : "Journal"}{" "}
            {view === "map" && planet?.faction && (
              <span className={`fac ${planet.faction}`}>{planet.faction === "imp" ? "IMPERIAL" : "REPUBLIC"}</span>
            )}
          </h1>
          <span className="grow" />
          <div className="top-search">
            {Icons.search()}
            <input
              id="top-search"
              placeholder={view === "journal" ? `Search journal  ${MOD}+K` : `Search  ${MOD}+K`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {view === "map" && (
            <Tip label={membersOpen ? "Hide who is here" : "Show who is here"} side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                className={membersOpen ? "text-primary" : ""}
                onClick={toggleMembers}
              >
                {Icons.users()}
              </Button>
            </Tip>
          )}
        </header>
        {view === "map" ? (
          <Boundary name="map">
            <MapView />
          </Boundary>
        ) : view === "registry" ? (
          <Boundary name="registry">
            <Registry />
          </Boundary>
        ) : (
          <Boundary name="journal">
            <Journal />
          </Boundary>
        )}
      </main>
      {view === "map" && (
        <Boundary name="member list">
          <Members />
        </Boundary>
      )}
      <Boundary name="dialog">
        <Modals />
      </Boundary>
      <Toaster />
    </div>
  );
}

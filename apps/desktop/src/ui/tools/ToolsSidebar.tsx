import type { CSSProperties } from "react";
import { useApp } from "../../store";
import { UserPanel } from "../Sidebar";
import { TOOLS } from "./tools";

export function ToolsSidebar() {
  const tool = useApp((s) => s.tool);
  const setTool = useApp((s) => s.setTool);
  return (
    <aside className="side">
      <div className="side-head" data-tauri-drag-region>
        Tools
      </div>
      <nav className="scroll tool-list" style={{ flex: 1 }} aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool-item ${tool === t.id ? "active" : ""}`}
            aria-current={tool === t.id ? "page" : undefined}
            style={{ "--tool-h": t.hue } as CSSProperties}
            onClick={() => setTool(t.id)}
          >
            <span className="tile">
              <t.icon size={17} aria-hidden="true" />
            </span>
            <span className="txt">
              <span className="nm">{t.name}</span>
              <span className="bl">{t.blurb}</span>
            </span>
          </button>
        ))}
      </nav>
      <UserPanel />
    </aside>
  );
}

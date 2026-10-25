import type { ComponentType } from "react";
import { Palette, type LucideIcon } from "lucide-react";
import type { ToolId } from "../../store";
import { ChatColors } from "./ChatColors";

export interface Tool {
  id: ToolId;
  name: string;
  blurb: string;
  icon: LucideIcon;
  /** The tool's accent, used for its icon tile. */
  hue: number;
  Component: ComponentType;
}

/** Every tool in the Tools view, in sidebar order. */
export const TOOLS: Tool[] = [
  {
    id: "chat-colors",
    name: "Chat colours",
    blurb: "One palette for all your characters",
    icon: Palette,
    hue: 205,
    Component: ChatColors,
  },
];

export const toolById = (id: ToolId) => TOOLS.find((t) => t.id === id) ?? TOOLS[0];

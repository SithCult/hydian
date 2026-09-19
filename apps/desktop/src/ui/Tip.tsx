import type { ReactElement, ReactNode } from "react";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The app's tooltip: wraps one element. No label, no tooltip (the child renders as-is), so callers can pass a
 * conditional. A disabled trigger gets no pointer events, so wrap those in a span yourself.
 */
export function Tip({
  label,
  side = "top",
  align = "center",
  kbd,
  children,
}: {
  label?: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  kbd?: string;
  children: ReactElement;
}) {
  if (!label) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {label}
        {kbd && <Kbd>{kbd}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

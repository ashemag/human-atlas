import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ControlTooltip({ children, label, side = "top" }: {
  children: ReactElement;
  label: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return <Tooltip>
    <TooltipTrigger render={children} />
    <TooltipContent className="control-tooltip" side={side} sideOffset={8}>{label}</TooltipContent>
  </Tooltip>;
}

"use client";

/**
 * ServiceChat Trigger Component
 *
 * Unified trigger button for all service chat assistants.
 * Supports tooltip and animations.
 *
 * ТЗ-09: ServiceChat унификация
 */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ServiceChatTriggerProps } from "./types";

export function ServiceChatTrigger({
  icon,
  tooltip,
  onClick,
  className,
}: ServiceChatTriggerProps) {
  const button = (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={className}
        aria-label={tooltip}
      >
        {icon}
      </Button>
    </motion.div>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

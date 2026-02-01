"use client";

/**
 * Prompt-Agent Trigger Button
 *
 * Opens the Prompt-agent drawer when clicked.
 * Icon: 📝 (pencil memo)
 */

import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TriggerButtonProps } from "../types";

export function PromptAgentTrigger({ onClick, className }: TriggerButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClick}
              className={className}
              aria-label="Помощь с промптом"
            >
              <Pencil className="h-5 w-5" />
            </Button>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Помощь с промптом</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

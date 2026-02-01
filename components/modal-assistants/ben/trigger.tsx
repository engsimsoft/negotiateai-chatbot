"use client";

/**
 * Ben Trigger Button
 *
 * Opens the Ben (help) drawer when clicked.
 * Icon: ❓ (question mark)
 */

import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TriggerButtonProps } from "../types";

export function BenTrigger({ onClick, className }: TriggerButtonProps) {
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
              aria-label="Помощь"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Помощь</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

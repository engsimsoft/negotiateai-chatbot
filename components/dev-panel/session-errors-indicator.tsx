"use client";

import { useState } from "react";

import { useDevPanelGlobalErrors } from "./dev-panel-provider";
import { SessionErrorsDrawer } from "./session-errors-drawer";

const IS_DEV_MODE = process.env.NEXT_PUBLIC_SIMPLY_DEV_MODE === "true";

/**
 * ТЗ-DevPanelErrors: small indicator chip in chat header showing the count of
 * global (non-message-bound) client errors. Hidden when no errors or when
 * dev mode is off.
 *
 * Click → opens SessionErrorsDrawer.
 */
export function SessionErrorsIndicator() {
  const errors = useDevPanelGlobalErrors();
  const [open, setOpen] = useState(false);

  if (!IS_DEV_MODE) return null;
  if (errors.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${errors.length} session errors`}
        className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 font-mono text-[11px] text-destructive hover:bg-destructive/20"
      >
        <span>&#9679;</span>
        <span>{errors.length}</span>
        <span className="hidden sm:inline">
          {errors.length === 1 ? "session error" : "session errors"}
        </span>
      </button>
      <SessionErrorsDrawer
        open={open}
        onOpenChange={setOpen}
        errors={errors}
      />
    </>
  );
}

"use client";

import { memo } from "react";
import { Button } from "./ui/button";

type ActionButton = {
  label: string;
  payload: string;
};

/**
 * Parse [button:Label|payload] patterns from message text.
 * Returns the buttons found and the text with buttons removed.
 */
export function parseActionButtons(text: string): {
  buttons: ActionButton[];
  cleanText: string;
} {
  const buttonRegex = /\[button:([^|]+)\|([^\]]+)\]/g;
  const buttons: ActionButton[] = [];
  let match: RegExpExecArray | null;

  while ((match = buttonRegex.exec(text)) !== null) {
    buttons.push({
      label: match[1].trim(),
      payload: match[2].trim(),
    });
  }

  const cleanText = text.replace(buttonRegex, "").trim();

  return { buttons, cleanText };
}

function PureActionButtons({
  buttons,
  onAction,
}: {
  buttons: ActionButton[];
  onAction: (payload: string) => void;
}) {
  if (buttons.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {buttons.map((button, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onAction(button.payload)}
        >
          {button.label}
        </Button>
      ))}
    </div>
  );
}

export const ActionButtons = memo(PureActionButtons);

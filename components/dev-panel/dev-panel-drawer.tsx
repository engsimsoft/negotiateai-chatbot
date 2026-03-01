"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { DevPanelMessageData } from "./dev-panel-provider";
import { ModelSection } from "./sections/model-section";
import { TokensSection } from "./sections/tokens-section";
import { TimelineSection } from "./sections/timeline-section";
import { GuardianSection } from "./sections/guardian-section";
import { PromptSection } from "./sections/prompt-section";
import { ToolsSection } from "./sections/tools-section";
import { CostBreakdownSection } from "./sections/cost-breakdown-section";
import { RawSection } from "./sections/raw-section";

export function DevPanelDrawer({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DevPanelMessageData;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:w-[440px]">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">DevPanel</SheetTitle>
          <SheetDescription className="sr-only">
            Debug information for this AI response
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 py-4">
          <ModelSection data={data} />
          <TokensSection data={data} />
          <CostBreakdownSection data={data} />
          <TimelineSection data={data} />
          <ToolsSection data={data} />
          <GuardianSection data={data} />
          <PromptSection data={data} />
          <RawSection data={data} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

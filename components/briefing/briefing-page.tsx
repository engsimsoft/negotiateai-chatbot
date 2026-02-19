import type { BriefingJSON } from "@/lib/briefing/briefing-types";
import { BriefingContent } from "./briefing-content";
import { BriefingEmpty } from "./briefing-empty";
import { BriefingGenerateButton } from "./briefing-generate-button";
import { BriefingHeader } from "./briefing-header";

interface BriefingPageProps {
  briefing: BriefingJSON | null;
}

export function BriefingPage({ briefing }: BriefingPageProps) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <BriefingHeader briefing={briefing} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 lg:px-6">
        {briefing ? (
          <div className="space-y-6">
            <BriefingContent briefing={briefing} />
            <div className="flex justify-center pt-4">
              <BriefingGenerateButton label="Обновить брифинг" />
            </div>
          </div>
        ) : (
          <BriefingEmpty />
        )}
      </main>
    </div>
  );
}

import type { BriefingHistory } from "@/lib/db/schema";
import { BriefingCard } from "@/components/briefing";
import { SectionTitle } from "./section-title";

interface ToolsSectionProps {
  latestBriefing: BriefingHistory | null;
  /** ТЗ-BF2: Unread Simply News indicator */
  hasSimplyUpdate?: boolean;
}

export function ToolsSection({ latestBriefing, hasSimplyUpdate }: ToolsSectionProps) {
  return (
    <section className="mb-10">
      <SectionTitle>Инструменты</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <BriefingCard latestBriefing={latestBriefing} hasSimplyUpdate={hasSimplyUpdate} />
      </div>
    </section>
  );
}

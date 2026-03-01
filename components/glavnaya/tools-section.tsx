import type { BriefingHistory } from "@/lib/db/schema";
import { BriefingCard } from "@/components/briefing";
import { MeetingCard } from "@/components/meeting/meeting-card";
import { SectionTitle } from "./section-title";

interface ToolsSectionProps {
  latestBriefing: BriefingHistory | null;
  /** ТЗ-BF2: Unread Simply News indicator */
  hasSimplyUpdate?: boolean;
  /** ТЗ-MR: Meeting records count for card */
  meetingRecordCount?: number;
  /** ТЗ-MR: Last meeting record title for card */
  lastMeetingTitle?: string | null;
}

export function ToolsSection({ latestBriefing, hasSimplyUpdate, meetingRecordCount = 0, lastMeetingTitle }: ToolsSectionProps) {
  return (
    <section className="mb-10">
      <SectionTitle>Инструменты</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <BriefingCard latestBriefing={latestBriefing} hasSimplyUpdate={hasSimplyUpdate} />
        <MeetingCard recordCount={meetingRecordCount} lastRecordTitle={lastMeetingTitle} />
      </div>
    </section>
  );
}

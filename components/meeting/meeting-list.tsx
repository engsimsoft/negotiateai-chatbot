// ТЗ-MR Этап 4: Meeting records list — previous recordings with tap-to-view

"use client";

import { useMemo } from "react";
import { Clock, Users, FileText, ChevronRight } from "lucide-react";

const LEVEL_LABELS: Record<string, string> = {
  compact: "Сводка",
  standard: "Протокол",
  detailed: "Детальный",
};

export interface MeetingListItem {
  id: string;
  title: string;
  durationSeconds: number;
  speakerCount: number;
  summaryLevel: string;
  createdAt: string;
}

interface MeetingListProps {
  records: MeetingListItem[];
  onSelect: (id: string) => void;
}

export function MeetingList({ records, onSelect }: MeetingListProps) {
  if (records.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        Предыдущие записи
      </h3>
      <div className="divide-y rounded-xl border bg-background">
        {records.map((record) => (
          <MeetingListRow
            key={record.id}
            record={record}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function MeetingListRow({
  record,
  onSelect,
}: {
  record: MeetingListItem;
  onSelect: (id: string) => void;
}) {
  const dateLabel = useMemo(() => {
    const d = new Date(record.createdAt);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Сегодня";
    if (days === 1) return "Вчера";
    if (days < 7) return `${days} дн. назад`;

    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  }, [record.createdAt]);

  const durationLabel = useMemo(() => {
    const mins = Math.round(record.durationSeconds / 60);
    return `${mins} мин`;
  }, [record.durationSeconds]);

  return (
    <button
      type="button"
      onClick={() => onSelect(record.id)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{record.title}</div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {durationLabel}
          </span>
          {record.speakerCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {record.speakerCount}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3" />
            {LEVEL_LABELS[record.summaryLevel] ?? record.summaryLevel}
          </span>
          <span>{dateLabel}</span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
    </button>
  );
}

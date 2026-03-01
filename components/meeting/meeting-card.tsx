import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface MeetingCardProps {
  recordCount: number;
  lastRecordTitle?: string | null;
}

export function MeetingCard({ recordCount, lastRecordTitle }: MeetingCardProps) {
  return (
    <Link
      href="/meeting"
      className="group flex items-center gap-3 rounded-xl border bg-background p-4 transition-all hover:border-primary hover:shadow-sm"
    >
      <span className="text-xl">🎙️</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">Запись встречи</div>
        <div className="truncate text-xs text-muted-foreground">
          {recordCount > 0 ? (
            <>
              {lastRecordTitle
                ? `${lastRecordTitle} · ${recordCount} ${formatRecordsWord(recordCount)}`
                : `${recordCount} ${formatRecordsWord(recordCount)} · Открыть`}
            </>
          ) : (
            <>Расшифровка и протокол · Попробовать</>
          )}
        </div>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </Link>
  );
}

function formatRecordsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return "записей";
  if (mod10 === 1) return "запись";
  if (mod10 >= 2 && mod10 <= 4) return "записи";
  return "записей";
}

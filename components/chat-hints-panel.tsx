"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// localStorage keys
const HINTS_DISMISSED_KEY = "simply-hints-dismissed";
const HINTS_COLLAPSED_KEY = "simply-hints-collapsed";

type HintSectionId = "mentions" | "documents" | "files";

interface HintSection {
  id: HintSectionId;
  icon: string;
  title: string;
}

const sections: HintSection[] = [
  { id: "mentions", icon: "👥", title: "Вызвать другого агента" },
  { id: "documents", icon: "📄", title: "Создание документов в холсте" },
  { id: "files", icon: "📎", title: "Работа с файлами" },
];

function MentionsHint() {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>
        Напишите <strong className="text-foreground">@Помощник</strong> или{" "}
        <strong className="text-foreground">@Маркетолог</strong> чтобы позвать
        другого агента прямо в этот чат.
      </p>
      <p>Он ответит и вы продолжите с текущим агентом.</p>
    </div>
  );
}

function DocumentsHint() {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium text-foreground">Агент может создать:</p>
        <ul className="mt-1.5 space-y-1 text-muted-foreground">
          <li>📝 <strong className="text-foreground">Документ</strong> — текст с форматированием</li>
          <li>🎯 <strong className="text-foreground">Презентация</strong> — слайды для выступлений</li>
        </ul>
      </div>

      <div>
        <p className="font-medium text-foreground">В холсте вы сможете:</p>
        <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
          <li>• Просмотреть результат перед скачиванием</li>
          <li>• Попросить агента внести изменения</li>
          <li>• Скачать как PDF или отправить ссылку</li>
        </ul>
      </div>

      <div>
        <p className="font-medium text-foreground">Примеры запросов:</p>
        <div className="mt-1.5 space-y-0.5 text-muted-foreground italic">
          <p>"Напиши маркетинговый план"</p>
          <p>"Сделай презентацию на 5 слайдов"</p>
          <p>"Составь коммерческое предложение"</p>
        </div>
      </div>
    </div>
  );
}

function FilesHint() {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium text-foreground">Вы можете прикрепить:</p>
        <ul className="mt-1.5 space-y-1 text-muted-foreground">
          <li>🖼️ <strong className="text-foreground">Изображения</strong> — агент увидит и проанализирует</li>
          <li>📄 <strong className="text-foreground">Документы</strong> (PDF, DOCX) — агент прочитает</li>
        </ul>
      </div>

      <div>
        <p className="font-medium text-foreground">Как:</p>
        <p className="mt-1 text-muted-foreground">
          Нажмите 📎 или перетащите файл в чат
        </p>
      </div>

      <div>
        <p className="font-medium text-foreground">Примеры:</p>
        <div className="mt-1.5 space-y-0.5 text-muted-foreground italic">
          <p>"Что на этой картинке?"</p>
          <p>"Проанализируй этот договор"</p>
        </div>
      </div>
    </div>
  );
}

const sectionContent: Record<HintSectionId, React.ReactNode> = {
  mentions: <MentionsHint />,
  documents: <DocumentsHint />,
  files: <FilesHint />,
};

interface ChatHintsPanelProps {
  messagesCount: number;
  hasUsedMentions: boolean;
  forceShow?: boolean;
  onDismiss?: () => void;
}

function PureChatHintsPanel({
  messagesCount,
  hasUsedMentions,
  forceShow,
  onDismiss,
}: ChatHintsPanelProps) {
  // Panel dismissed state
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash
  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<HintSectionId>>(
    new Set()
  );

  // Load state from localStorage on mount
  useEffect(() => {
    const dismissedStored = localStorage.getItem(HINTS_DISMISSED_KEY);
    setDismissed(dismissedStored === "true");

    const collapsedStored = localStorage.getItem(HINTS_COLLAPSED_KEY);
    if (collapsedStored) {
      try {
        const parsed = JSON.parse(collapsedStored) as HintSectionId[];
        setCollapsedSections(new Set(parsed));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(HINTS_DISMISSED_KEY, "true");
    onDismiss?.();
  }, [onDismiss]);

  const toggleSection = useCallback((sectionId: HintSectionId) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      // Save to localStorage
      localStorage.setItem(HINTS_COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Show if: forced, or (not dismissed AND not used mentions AND empty chat)
  const shouldShow =
    forceShow || (!dismissed && !hasUsedMentions && messagesCount === 0);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-sm">💡</span>
          <span className="text-sm font-medium text-foreground">Подсказки</span>
        </div>
        <button
          aria-label="Закрыть панель подсказок"
          className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          onClick={handleDismiss}
          type="button"
        >
          <X size={14} />
        </button>
      </div>

      {/* Sections */}
      <div className="divide-y divide-border/50">
        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.id);

          return (
            <Collapsible
              key={section.id}
              open={!isCollapsed}
              onOpenChange={() => toggleSection(section.id)}
            >
              <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                {isCollapsed ? (
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                )}
                <span className="shrink-0">{section.icon}</span>
                <span className="text-sm font-medium text-foreground">
                  {section.title}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 pt-1 pl-9">
                  {sectionContent[section.id]}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

export const ChatHintsPanel = memo(PureChatHintsPanel);

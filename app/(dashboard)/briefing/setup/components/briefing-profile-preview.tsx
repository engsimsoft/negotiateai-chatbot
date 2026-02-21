"use client";

/**
 * Briefing Profile Preview
 *
 * Shows live preview of briefing profile during onboarding.
 * Topics with emoji, sources grouped by topic, settings summary.
 * Updates in real-time as AI finds sources.
 *
 * ТЗ-A2: Briefing Onboarding
 */

import { Globe, Rss, MessageCircle } from "lucide-react";

export interface BriefingTopic {
  topicId: string;
  topicName: string;
  emoji: string;
  briefingStyle?: string;
}

export interface BriefingSource {
  topicId: string;
  sourceName: string;
  sourceUrl: string;
  rssUrl?: string | null;
  fetchMethod: string;
  sourceLanguage: string;
  tier: string;
}

export interface BriefingSettings {
  timezone?: string;
  language?: string;
  maxItems?: number;
  volume?: string;
}

export interface BriefingProfile {
  topics: BriefingTopic[];
  sources: BriefingSource[];
  settings?: BriefingSettings;
}

const TIER_LABELS: Record<string, string> = {
  flagship: "Флагман",
  respected: "Авторитет",
  niche: "Нишевый",
  community: "Сообщество",
};

const VOLUME_LABELS: Record<string, string> = {
  compact: "Компактный",
  standard: "Стандартный",
  detailed: "Подробный",
};

const FETCH_ICONS: Record<string, typeof Globe> = {
  rss: Rss,
  telegram_parse: MessageCircle,
  jina: Globe,
};

interface BriefingProfilePreviewProps {
  profile: BriefingProfile;
}

export function BriefingProfilePreview({
  profile,
}: BriefingProfilePreviewProps) {
  const { topics, sources, settings } = profile;
  const isEmpty = topics.length === 0;

  // Group sources by topicId
  const sourcesByTopic = new Map<string, BriefingSource[]>();
  for (const s of sources) {
    const list = sourcesByTopic.get(s.topicId) || [];
    list.push(s);
    sourcesByTopic.set(s.topicId, list);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Профиль брифинга</h2>
        <p className="text-sm text-muted-foreground">
          Заполняется по ходу диалога
        </p>
      </div>

      {isEmpty ? (
        /* Empty state */
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="mb-3 text-4xl">☀️</span>
          <p className="text-sm text-muted-foreground">
            Расскажите о ваших интересах —
            <br />
            темы и источники появятся здесь
          </p>
        </div>
      ) : (
        /* Topics + sources */
        <div className="flex-1 space-y-5 overflow-auto">
          {topics.map((topic) => {
            const topicSources = sourcesByTopic.get(topic.topicId) || [];
            return (
              <div
                key={topic.topicId}
                className="animate-in fade-in duration-300"
              >
                {/* Topic header */}
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{topic.emoji}</span>
                    <span className="text-sm font-medium">{topic.topicName}</span>
                    {topicSources.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({topicSources.length})
                      </span>
                    )}
                  </div>
                  {topic.briefingStyle && (
                    <p className="ml-7 mt-0.5 text-xs text-muted-foreground leading-snug">
                      {topic.briefingStyle}
                    </p>
                  )}
                </div>

                {/* Sources list */}
                {topicSources.length > 0 && (
                  <div className="ml-7 space-y-1.5">
                    {topicSources.map((source) => {
                      const FetchIcon =
                        FETCH_ICONS[source.fetchMethod] || Globe;
                      return (
                        <div
                          key={`${source.topicId}-${source.sourceUrl}`}
                          className="flex items-start gap-2 text-xs"
                        >
                          <FetchIcon className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">
                              {source.sourceName}
                            </span>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="rounded bg-muted px-1 py-0.5 text-[10px]">
                                {TIER_LABELS[source.tier] || source.tier}
                              </span>
                              <span className="uppercase">
                                {source.sourceLanguage}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Settings summary (bottom) */}
      {settings && (
        <div className="mt-4 border-t pt-3">
          <div className="space-y-1 text-xs text-muted-foreground">
            {settings.language && (
              <div>
                Язык:{" "}
                {settings.language === "both"
                  ? "русский + английский"
                  : settings.language === "en"
                    ? "английский"
                    : "русский"}
              </div>
            )}
            {settings.volume && (
              <div>
                Объём: {VOLUME_LABELS[settings.volume] ?? settings.volume}
              </div>
            )}
            {settings.maxItems && <div>Новостей: до {settings.maxItems}</div>}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mt-3 flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${topics.length > 0 ? "bg-green-500" : "bg-yellow-500"}`}
        />
        <span className="text-xs text-muted-foreground">
          {topics.length > 0
            ? `${topics.length} тем, ${sources.length} источников`
            : "Ожидание тем"}
        </span>
      </div>
    </div>
  );
}

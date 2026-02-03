import { SectionTitle } from "./section-title";

interface Tool {
  id: string;
  name: string;
  emoji: string;
  description: string;
  comingSoon: boolean;
}

const TOOLS: Tool[] = [
  {
    id: "dictaphone",
    name: "Диктофон",
    emoji: "🎙️",
    description: "Запись → текст",
    comingSoon: true,
  },
  {
    id: "research",
    name: "Исследование",
    emoji: "🔍",
    description: "Глубокий анализ темы",
    comingSoon: true,
  },
  {
    id: "briefing",
    name: "Брифинг",
    emoji: "☀️",
    description: "Утренний дайджест",
    comingSoon: true,
  },
];

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-background p-3.5 transition-all ${
        tool.comingSoon
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-primary hover:shadow-sm"
      }`}
    >
      <div className="shrink-0 text-xl">{tool.emoji}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{tool.name}</span>
          {tool.comingSoon && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Скоро
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{tool.description}</div>
      </div>
    </div>
  );
}

export function ToolsSection() {
  return (
    <section>
      <SectionTitle>Инструменты</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}

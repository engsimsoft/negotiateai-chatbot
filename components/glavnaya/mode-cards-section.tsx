import Link from "next/link";
import { ArrowRight, FolderOpen, Search, Sparkles } from "lucide-react";

const MODE_CARDS = [
  {
    title: "Экспертиза",
    description: "Точные ответы с проверкой фактов",
    emoji: "🔍",
    icon: Search,
    href: "/expertise",
  },
  {
    title: "Создать",
    description: "Презентации, отчёты, изображения",
    emoji: "✨",
    icon: Sparkles,
    href: "/create",
  },
  {
    title: "Проекты",
    description: "Сложная работа с вашими данными",
    emoji: "📁",
    icon: FolderOpen,
    href: "/projects",
  },
] as const;

export function ModeCardsSection() {
  return (
    <section className="mb-10">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODE_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-center gap-3 rounded-xl border bg-background p-4 transition-all hover:border-primary hover:shadow-sm"
          >
            <span className="text-xl">{card.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground">{card.title}</div>
              <div className="text-xs text-muted-foreground">
                {card.description}
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </section>
  );
}

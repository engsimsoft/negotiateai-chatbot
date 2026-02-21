import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { BriefingHeader } from "./briefing-header";

interface BriefingPageProps {
  /** ТЗ-BF2: Simply News content + title (shown when hasUpdate) */
  simplyNewsTitle?: string | null;
  simplyNewsContent?: string | null;
}

export function BriefingPage({ simplyNewsTitle, simplyNewsContent }: BriefingPageProps) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <BriefingHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 lg:px-6">
        {/* Hero */}
        <section className="mb-12 text-center">
          <span className="mb-4 inline-block text-5xl">☀️</span>
          <h2 className="mb-3 font-serif text-2xl font-semibold">
            Ваш персональный утренний брифинг
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            AI находит лучшие источники по вашим интересам со всего мира,
            анализирует и каждое утро готовит выпуск — читайте как статью
            или слушайте как подкаст.
          </p>
        </section>

        {/* Demo */}
        <section className="mb-12">
          <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
            Пример выпуска
          </p>
          <div className="space-y-4">
            <DemoBlock
              emoji="⚡"
              title="Главное"
              items={[
                {
                  title: "Claude 4 получил возможность работать с видео в реальном времени",
                  text: "Anthropic открыла доступ к мультимодальному анализу видео. Модель распознаёт действия, читает текст на экране и отвечает на вопросы по содержанию. Для разработчиков — новый класс задач: от модерации контента до автоматической документации.",
                  source: "The Verge",
                },
              ]}
            />
            <DemoBlock
              emoji="🚀"
              title="Стартапы"
              items={[
                {
                  title: "Российский AI-стартап привлёк $12M на платформу для автоматизации отчётности",
                  text: "Раунд возглавил фонд из ОАЭ. Продукт заменяет ручной сбор данных из разных систем: финансы, HR, операционка — всё собирается в один дашборд с комментариями AI.",
                  source: "vc.ru",
                },
              ]}
            />
            <DemoBlock
              emoji="💰"
              title="Финансы"
              items={[
                {
                  title: "ЦБ рассматривает цифровой рубль как платёжное средство для B2B к концу года",
                  text: "Пилотная группа расширена до 500 компаний. Основной сценарий — оплата между юрлицами с мгновенным расчётом и сниженной комиссией. Банки адаптируют API.",
                  source: "РБК",
                },
              ]}
            />
          </div>
        </section>

        {/* ТЗ-BF2: Simply News section for inactive users */}
        {simplyNewsTitle && simplyNewsContent && (
          <section className="mb-12">
            <div className="rounded-xl border bg-background p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <span>🔔</span>
                <span>{simplyNewsTitle}</span>
              </h3>
              <MarkdownViewer content={simplyNewsContent} className="text-sm" />
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="text-center">
          <Link href="/briefing/setup">
            <Button size="lg" className="gap-2">
              Настроить мой брифинг
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Займёт пару минут. AI подберёт лучшие источники под ваши интересы.
          </p>
        </section>
      </main>
    </div>
  );
}

/* --- Demo components (local, not exported) --- */

function DemoBlock({
  emoji,
  title,
  items,
}: {
  emoji: string;
  title: string;
  items: { title: string; text: string; source: string }[];
}) {
  return (
    <div className="rounded-xl border bg-background p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <span>{emoji}</span>
        <span>{title}</span>
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.title}>
            <p className="font-medium text-foreground">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {item.source}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

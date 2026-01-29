import { notFound, redirect } from "next/navigation";
import { getAgentBySlug } from "@/lib/db/queries";
import type { AgentCapabilities } from "@/lib/db/schema";
import { auth } from "../../../(auth)/auth";
import { AgentsHeader } from "../agents-header";
import { StartChatButton } from "./start-chat-button";

interface AgentPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const agent = await getAgentBySlug({ slug });

  if (!agent) {
    notFound();
  }

  const capabilities = agent.capabilities as AgentCapabilities;
  const toolAccess = agent.toolAccess as string[] | null;

  // Map tool IDs to readable names
  const toolNames: Record<string, string> = {
    webSearch: "Поиск в интернете",
    getWeather: "Прогноз погоды",
    retrieveUrl: "Анализ сайтов",
    createDocument: "Создание документов",
    updateDocument: "Редактирование документов",
    requestSuggestions: "Генерация предложений",
    createPresentation: "Создание презентаций",
    createWebPresentation: "Веб-презентации",
    runPython: "Python код",
    generateImage: "Генерация изображений",
  };

  // If toolAccess is null, agent has access to all tools
  const displayTools = toolAccess
    ? toolAccess.map((t) => toolNames[t] || t)
    : ["Все инструменты"];

  return (
    <div className="flex h-dvh flex-col bg-background">
      <AgentsHeader
        title=""
        backLink={{ href: "/agents", label: "← Назад к каталогу" }}
      />

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          {/* Agent Header */}
          <div className="mb-8 rounded-lg border bg-card p-6">
            <div className="flex items-start gap-4 mb-4">
              <span className="text-5xl" aria-hidden="true">
                {agent.icon}
              </span>
              <div className="flex-1">
                <h1 className="text-2xl font-semibold mb-2">{agent.name}</h1>
                <p className="text-muted-foreground">{agent.description}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <StartChatButton agentId={agent.id} />
            </div>
          </div>

          {/* Superpowers */}
          {capabilities.superpowers?.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
                <span>Суперсилы</span>
              </h2>
              <div className="rounded-lg border bg-card p-4">
                <ul className="space-y-2">
                  {capabilities.superpowers.map((power, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>{power}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Tools */}
          <section className="mb-6">
            <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
              <span>Инструменты</span>
            </h2>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap gap-2">
                {displayTools.map((tool, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-secondary px-3 py-1 text-sm"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Example Tasks */}
          {capabilities.exampleTasks?.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
                <span>Примеры задач</span>
              </h2>
              <div className="rounded-lg border bg-card p-4">
                <ul className="space-y-3">
                  {capabilities.exampleTasks.map((task, i) => (
                    <li
                      key={i}
                      className="rounded-md bg-muted/50 p-3 text-sm italic"
                    >
                      "{task}"
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Limitations */}
          {capabilities.limitations?.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
                <span>Ограничения</span>
              </h2>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
                <ul className="space-y-2 text-sm">
                  {capabilities.limitations.map((limitation, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-yellow-600 dark:text-yellow-400">
                        ⚠
                      </span>
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

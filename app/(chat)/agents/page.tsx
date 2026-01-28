import Link from "next/link";
import { redirect } from "next/navigation";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getAgents } from "@/lib/db/queries";
import { auth } from "../../(auth)/auth";

export default async function AgentsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const agents = await getAgents();

  // Filter: only catalog agents (not system helper)
  const catalogAgents = agents.filter((a) => a.type === "catalog");

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
        <SidebarToggle />
        <h1 className="text-lg font-semibold">AI Агенты</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          {/* Page Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-2">Каталог агентов</h2>
            <p className="text-muted-foreground">
              Проработанные агенты для решения бизнес-задач
            </p>
          </div>

          {/* My Agents Section (placeholder) */}
          <section className="mb-8">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <span>Мои агенты</span>
            </h3>
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <p>Персональные агенты появятся здесь после настройки</p>
            </div>
          </section>

          {/* Catalog Section */}
          <section>
            <h3 className="text-lg font-medium mb-4">Доступные агенты</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalogAgents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.slug}`}
                  className="group flex flex-col rounded-lg border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="mb-3 flex items-start gap-3">
                    <span className="text-3xl" aria-hidden="true">
                      {agent.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold group-hover:text-primary transition-colors">
                        {agent.name}
                      </h4>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

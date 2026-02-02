import { ToolCard } from "./tool-card";
import { MessageSquare, FolderOpen } from "lucide-react";

export function ToolsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ToolCard
        title="Чат"
        description="AI-помощник для любых задач"
        icon={<MessageSquare className="size-10 text-primary" />}
        href="/chat"
      />
      <ToolCard
        title="Проекты"
        description="Организуйте чаты по проектам"
        icon={<FolderOpen className="size-10 text-primary" />}
        href="/projects"
      />
    </div>
  );
}

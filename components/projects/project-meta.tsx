import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface ProjectMetaProps {
  createdAt: Date;
  chatsCount: number;
  filesCount: number;
}

/**
 * ТЗ-07A: Мета-информация о проекте внизу страницы
 */
export function ProjectMeta({ createdAt, chatsCount, filesCount }: ProjectMetaProps) {
  const formattedDate = format(createdAt, "d MMMM yyyy", { locale: ru });

  return (
    <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
      <span>Создан: {formattedDate}</span>
      <span>Задач: {chatsCount}</span>
      <span>Файлов: {filesCount}</span>
    </div>
  );
}

import { WelcomeState } from "./phase-states/welcome-state";
import { PlanningState } from "./phase-states/planning-state";
import { ApprovedState } from "./phase-states/approved-state";
import { ExecutionState } from "./phase-states/execution-state";
import { CompletedState } from "./phase-states/completed-state";

type TaskStatus = "not_started" | "in_progress" | "done";

interface Task {
  id: string;
  title: string;
  summary: string | null;
  taskStatus: TaskStatus;
  createdAt: Date;
}

interface ProjectWorkAreaProps {
  projectId: string;
  phase: string;
  tasks: Task[];
  hasFiles: boolean;
}

/**
 * ТЗ-A1: Рабочая область — рендерит контент по фазе проекта
 *
 * Фазы: setup | documents | planning | approved | execution | completed
 */
export function ProjectWorkArea({
  projectId,
  phase,
  tasks,
  hasFiles,
}: ProjectWorkAreaProps) {
  switch (phase) {
    case "setup":
    case "documents":
      return <WelcomeState projectId={projectId} hasFiles={hasFiles} />;

    case "planning":
      return <PlanningState />;

    case "approved":
      return <ApprovedState />;

    case "execution":
      return <ExecutionState projectId={projectId} tasks={tasks} />;

    case "completed":
      return <CompletedState />;

    default:
      return <WelcomeState projectId={projectId} hasFiles={hasFiles} />;
  }
}

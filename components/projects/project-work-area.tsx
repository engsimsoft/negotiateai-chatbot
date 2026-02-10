import { WelcomeState } from "./phase-states/welcome-state";
import { PlanningState } from "./phase-states/planning-state";
import { ApprovedState } from "./phase-states/approved-state";
import { ExecutionState } from "./phase-states/execution-state";
import { CompletedState } from "./phase-states/completed-state";
import type { ProfessorPlanJson } from "@/lib/ai/professor-types";
import type { ProjectTask } from "@/lib/db/schema";

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
  planJson: ProfessorPlanJson | null;
  planReport: string | null;
  projectTasks: ProjectTask[];
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
  planJson,
  planReport,
  projectTasks,
}: ProjectWorkAreaProps) {
  switch (phase) {
    case "setup":
    case "documents":
      return <WelcomeState projectId={projectId} hasFiles={hasFiles} />;

    case "planning":
      return (
        <PlanningState
          projectId={projectId}
          planJson={planJson}
          planReport={planReport}
        />
      );

    case "approved":
      return <ApprovedState projectId={projectId} projectTasks={projectTasks} />;

    case "execution":
      return <ExecutionState projectId={projectId} tasks={tasks} projectTasks={projectTasks} />;

    case "completed":
      return <CompletedState projectId={projectId} projectTasks={projectTasks} />;

    default:
      return <WelcomeState projectId={projectId} hasFiles={hasFiles} />;
  }
}

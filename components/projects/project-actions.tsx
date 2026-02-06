"use client";

import { useState } from "react";
import { TaskHistoryCard } from "./task-history-card";
import { NewTaskCard } from "./new-task-card";
import { ManagerCard } from "./manager-card";
import {
  ServiceChatDrawer,
  PROJECT_MANAGER_CONFIG,
} from "@/components/service-chat";

interface ProjectActionsProps {
  projectId: string;
  tasksCount: number;
}

/**
 * ТЗ-07C3: Секция с тремя карточками действий
 * Layout: row на desktop, column на mobile
 */
export function ProjectActions({ projectId, tasksCount }: ProjectActionsProps) {
  const [managerOpen, setManagerOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <TaskHistoryCard projectId={projectId} count={tasksCount} />
        <NewTaskCard projectId={projectId} />
        <ManagerCard onOpen={() => setManagerOpen(true)} />
      </div>

      <ServiceChatDrawer
        config={PROJECT_MANAGER_CONFIG}
        open={managerOpen}
        onOpenChange={setManagerOpen}
        context={{ projectId }}
      />
    </>
  );
}

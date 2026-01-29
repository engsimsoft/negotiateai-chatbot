"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateUUID } from "@/lib/utils";
import { OnboardingDialog } from "./onboarding-dialog";

interface AgentForSelector {
  id: string; // slug for URL
  agentId: string; // uuid for DB
  name: string;
  icon: string;
  description: string;
}

interface AgentSelectorProps {
  agents: AgentForSelector[];
  userName: string;
  needsOnboarding?: boolean;
}

export function AgentSelector({
  agents,
  userName,
  needsOnboarding = false,
}: AgentSelectorProps) {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);

  const handleSelectAgent = (agentId: string) => {
    const newChatId = generateUUID();
    router.push(`/chat/${newChatId}?agentId=${agentId}`);
  };

  return (
    <>
      {showOnboarding && (
        <OnboardingDialog
          onComplete={() => {
            setShowOnboarding(false);
            router.refresh();
          }}
        />
      )}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-semibold mb-2">
              Привет, {userName}! 👋
            </h1>
            <p className="text-muted-foreground">
              Выберите агента для начала работы
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <button
                key={agent.agentId}
                onClick={() => handleSelectAgent(agent.agentId)}
                className="group relative flex flex-col p-6 rounded-lg border bg-card hover:bg-accent hover:shadow-lg transition-all duration-200 text-left"
              >
                <div className="flex items-start gap-4 mb-3">
                  <span className="text-4xl flex-shrink-0" aria-hidden="true">
                    {agent.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                      {agent.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {agent.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

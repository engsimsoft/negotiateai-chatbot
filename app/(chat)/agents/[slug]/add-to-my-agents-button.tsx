"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { PersonalizationDialog } from "@/components/personalization-dialog";
import { fetcher } from "@/lib/utils";

interface UserAgent {
  id: string;
  sourceAgentId: string;
  name: string;
}

interface AddToMyAgentsButtonProps {
  agent: {
    id: string;
    name: string;
    icon: string;
  };
}

export function AddToMyAgentsButton({ agent }: AddToMyAgentsButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Check if user already has this agent personalized
  const { data: userAgents, mutate } = useSWR<UserAgent[]>(
    "/api/user-agents",
    fetcher
  );

  const existingPersonalization = userAgents?.find(
    (ua) => ua.sourceAgentId === agent.id
  );

  const handleSuccess = () => {
    // Refresh the user agents list
    mutate();
  };

  if (existingPersonalization) {
    return (
      <Button variant="outline" disabled>
        <Check className="mr-2 size-4" />
        Уже добавлен
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
        <Plus className="mr-2 size-4" />В мои агенты
      </Button>

      {isDialogOpen && (
        <PersonalizationDialog
          agent={agent}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

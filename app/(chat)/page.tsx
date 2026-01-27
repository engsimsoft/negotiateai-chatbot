import { redirect } from "next/navigation";
import { AgentSelector } from "@/components/agent-selector";
import { getAgentsByRole } from "@/lib/ai/agents";
import { auth } from "../(auth)/auth";

export default async function Page() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/api/auth/guest");
  }

  // Get user role from session (default to engineer if not set)
  const userRole = (session.user.role || "engineer") as "engineer" | "marketer";

  // Get agents available for this user role
  const availableAgents = getAgentsByRole(userRole);

  // Get user name for greeting
  const userName = session.user.email?.split('@')[0] || 'там';

  return (
    <AgentSelector
      agents={availableAgents}
      userName={userName}
    />
  );
}

import { redirect } from "next/navigation";
import { AgentSelector } from "@/components/agent-selector";
import { getAgents, getUserById } from "@/lib/db/queries";
import { auth } from "../(auth)/auth";

export default async function Page() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  // Get all active agents from database
  const agents = await getAgents();

  // Transform to format expected by AgentSelector
  const availableAgents = agents
    .filter((a) => a.type === "catalog") // Only show catalog agents, not system
    .map((a) => ({
      id: a.slug,
      agentId: a.id,
      name: a.name,
      icon: a.icon,
      description: a.description,
    }));

  // Get user profile for greeting
  const userProfile = await getUserById(session.user.id);
  const userName =
    userProfile?.displayName ||
    session.user.email?.split("@")[0] ||
    "там";

  // Check if user needs onboarding (no displayName set)
  const needsOnboarding = !userProfile?.displayName;

  return (
    <AgentSelector
      agents={availableAgents}
      userName={userName}
      needsOnboarding={needsOnboarding}
    />
  );
}

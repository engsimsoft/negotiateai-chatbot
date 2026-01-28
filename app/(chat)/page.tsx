import { redirect } from "next/navigation";
import { AgentSelector } from "@/components/agent-selector";
import { getAgents } from "@/lib/db/queries";
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

  // Get user name for greeting
  const userName = session.user.email?.split("@")[0] || "там";

  return <AgentSelector agents={availableAgents} userName={userName} />;
}

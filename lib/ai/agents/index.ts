/**
 * AI Agents System
 *
 * Each agent has a unique role, system prompt, and AI model.
 * Agents are filtered by user role (engineer/marketer).
 */

export type AgentId =
  | "marketer"
  | "copywriter"
  | "translator"
  | "cook"
  | "astrologer"
  | "mentor"
  | "universal"
  | "odessit";

export type UserRole = "engineer" | "marketer";

export type Agent = {
  id: AgentId;
  name: string;
  icon: string;
  description: string;
  availableFor: UserRole | "both";
  defaultModel: "gemini-3-pro" | "gemini-2.5-flash";
  greeting: string;
};

/**
 * List of all available agents
 */
export const AGENTS: Agent[] = [
  {
    id: "marketer",
    name: "Маркетолог",
    icon: "📊",
    description: "Стратегия продвижения для VK и Telegram, автоспорт",
    availableFor: "marketer",
    defaultModel: "gemini-3-pro",
    greeting: "Привет! Над какой маркетинговой задачей работаем?",
  },
  {
    id: "copywriter",
    name: "Копирайтер",
    icon: "✍️",
    description: "Посты для соцсетей, молодёжный стиль, SMM",
    availableFor: "marketer",
    defaultModel: "gemini-3-pro",
    greeting: "Привет! Готова помочь с текстом для VK или Telegram. О чём пишем?",
  },
  {
    id: "translator",
    name: "Переводчик",
    icon: "🌐",
    description: "Технический перевод, автозапчасти, документация",
    availableFor: "marketer",
    defaultModel: "gemini-3-pro",
    greeting: "Привет! Что нужно перевести?",
  },
  {
    id: "cook",
    name: "Кулинар",
    icon: "🍳",
    description: "Рецепты, советы по готовке, домашняя кухня",
    availableFor: "marketer",
    defaultModel: "gemini-2.5-flash",
    greeting: "Привет! Что будем готовить сегодня?",
  },
  {
    id: "astrologer",
    name: "Астролог",
    icon: "⭐",
    description: "Гороскопы, советы по дням, цвета и стиль",
    availableFor: "marketer",
    defaultModel: "gemini-2.5-flash",
    greeting: "Привет, Близнецы! ✨ Чем могу помочь сегодня?",
  },
  {
    id: "mentor",
    name: "Наставник",
    icon: "📚",
    description: "Личностный рост, цели, 7 навыков Кови",
    availableFor: "both",
    defaultModel: "gemini-3-pro",
    greeting: "Привет! Над чем хочешь поработать сегодня?",
  },
  {
    id: "universal",
    name: "Универсальный",
    icon: "💬",
    description: "Помощь с любыми задачами и вопросами",
    availableFor: "both",
    defaultModel: "gemini-2.5-flash",
    greeting: "Привет! Чем могу помочь?",
  },
  {
    id: "odessit",
    name: "Одессит",
    icon: "😄",
    description: "Одесский юмор, истории, поднять настроение",
    availableFor: "both",
    defaultModel: "gemini-2.5-flash",
    greeting: "О, кого я вижу! Ну шо, рассказывай, шо у тебя там?",
  },
];

/**
 * Get agents available for a specific user role
 */
export function getAgentsByRole(role: UserRole): Agent[] {
  return AGENTS.filter(
    (agent) => agent.availableFor === role || agent.availableFor === "both"
  );
}

/**
 * Get agent by ID
 */
export function getAgentById(id: AgentId): Agent | undefined {
  return AGENTS.find((agent) => agent.id === id);
}

/**
 * Get the default AI model for an agent
 */
export function getModelForAgent(agentId: AgentId): string {
  const agent = getAgentById(agentId);
  return agent?.defaultModel || "gemini-2.5-flash";
}

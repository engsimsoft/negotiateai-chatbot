"use client";

/**
 * Ben Drawer
 *
 * Help assistant drawer with onboarding support.
 */

import { AssistantDrawer } from "../assistant-drawer";
import { AssistantChat } from "../assistant-chat";

// Ben greetings (static for client-side)
const ONBOARDING_GREETING = `Привет! 👋 Я Бен, твой гид по Simply.

**Кратко о платформе:**
- Simply — это AI-помощник для бизнеса
- Пишет тексты, создаёт таблицы, презентации
- Ищет информацию в интернете
- Работает с твоими документами

**Как начать:**
Просто напиши свою задачу в чат — например:
- "Напиши пост про новый продукт"
- "Создай таблицу расходов"
- "Найди информацию о конкурентах"

Есть вопросы? Спрашивай — я помогу разобраться!`;

const REGULAR_GREETING = `Привет! Я Бен. Чем могу помочь?

Спрашивай о возможностях Simply или как лучше сформулировать запрос.`;

interface BenDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFirstTime?: boolean;
}

export function BenDrawer({
  open,
  onOpenChange,
  isFirstTime = false,
}: BenDrawerProps) {
  const greeting = isFirstTime ? ONBOARDING_GREETING : REGULAR_GREETING;

  return (
    <AssistantDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Бен"
      description="Помощь по платформе Simply"
    >
      <AssistantChat
        assistantId="ben"
        initialMessage={greeting}
        isFirstTime={isFirstTime}
      />
    </AssistantDrawer>
  );
}

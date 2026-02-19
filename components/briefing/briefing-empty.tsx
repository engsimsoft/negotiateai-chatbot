import { BriefingGenerateButton } from "./briefing-generate-button";

export function BriefingEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="mb-4 text-5xl">☀️</span>
      <h2 className="mb-2 font-serif text-xl font-semibold">
        Ваш первый брифинг ещё не создан
      </h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Мы соберём для вас самые важные новости из выбранных источников
      </p>
      <BriefingGenerateButton />
    </div>
  );
}

interface GlavnayaGreetingProps {
  displayName: string;
}

export function GlavnayaGreeting({ displayName }: GlavnayaGreetingProps) {
  // Get time-based greeting
  const hour = new Date().getHours();
  let greeting = "Добрый день";
  if (hour < 6) greeting = "Доброй ночи";
  else if (hour < 12) greeting = "Доброе утро";
  else if (hour >= 18) greeting = "Добрый вечер";

  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
        {greeting}, {displayName}
      </h1>
      <p className="mt-1 text-muted-foreground">
        Чем могу помочь?
      </p>
    </div>
  );
}

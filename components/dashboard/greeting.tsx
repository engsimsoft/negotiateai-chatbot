interface DashboardGreetingProps {
  displayName: string;
}

export function DashboardGreeting({ displayName }: DashboardGreetingProps) {
  // Get time-based greeting
  const hour = new Date().getHours();
  let greeting = "Добрый день";
  if (hour < 6) greeting = "Доброй ночи";
  else if (hour < 12) greeting = "Доброе утро";
  else if (hour >= 18) greeting = "Добрый вечер";

  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold md:text-4xl">
        {greeting}, {displayName}!
      </h1>
      <p className="mt-2 text-muted-foreground">
        Чем займёмся сегодня?
      </p>
    </div>
  );
}

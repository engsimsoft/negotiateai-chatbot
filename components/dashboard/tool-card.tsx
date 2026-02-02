import Link from "next/link";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  href?: string;
  disabled?: boolean;
  badge?: string;
}

export function ToolCard({
  title,
  description,
  icon,
  href,
  disabled = false,
  badge,
}: ToolCardProps) {
  const cardContent = (
    <>
      <div className="text-4xl">{icon}</div>
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {badge && (
        <span className="absolute right-3 top-3 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {badge}
        </span>
      )}
    </>
  );

  const baseClasses = cn(
    "relative flex h-40 w-full flex-col items-center justify-center gap-3 rounded-xl border p-6 transition-all duration-200",
    "sm:h-44 sm:w-52",
    disabled
      ? "cursor-not-allowed bg-muted/50 opacity-60"
      : "bg-card text-card-foreground shadow-sm hover:bg-accent hover:shadow-md"
  );

  if (disabled || !href) {
    return <div className={baseClasses}>{cardContent}</div>;
  }

  return (
    <Link href={href} className={baseClasses}>
      {cardContent}
    </Link>
  );
}

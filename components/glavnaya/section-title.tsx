interface SectionTitleProps {
  children: React.ReactNode;
  count?: number;
}

export function SectionTitle({ children, count }: SectionTitleProps) {
  return (
    <div className="mb-4 mt-2 flex items-center gap-2.5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h2>
      {count !== undefined && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  );
}

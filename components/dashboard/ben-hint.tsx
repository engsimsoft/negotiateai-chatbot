import { HelpCircle } from "lucide-react";

export function BenHint() {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <span>Need help? Бен в углу — нажми</span>
      <HelpCircle className="size-4 shrink-0" />
    </div>
  );
}

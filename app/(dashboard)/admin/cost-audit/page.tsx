import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Clock,
  Activity,
} from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import { isSimplyDevMode } from "@/lib/constants";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui/badge";
import {
  getInvalidDeliveryStateUsers,
  getLastCronRuns,
  getCostByPeriod,
  getCostByChatModeForRange,
  getNullCostRecordsForRange,
  getCostByModel,
  type CostPeriod,
} from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Preset definitions (matching Anthropic Console style)
// ---------------------------------------------------------------------------

const PRESETS = [
  { label: "24ч",  period: "hour"  as CostPeriod, range: 24,  days: 1   },
  { label: "7д",   period: "day"   as CostPeriod, range: 7,   days: 7   },
  { label: "30д",  period: "day"   as CostPeriod, range: 30,  days: 30  },
  { label: "3м",   period: "month" as CostPeriod, range: 3,   days: 90  },
  { label: "12м",  period: "month" as CostPeriod, range: 12,  days: 365 },
] as const;

type PresetLabel = (typeof PRESETS)[number]["label"];

function getPreset(label: string | undefined) {
  return PRESETS.find((p) => p.label === label) ?? PRESETS[2]; // default: 30д
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatUsd(value: number | null, digits = 4): string {
  if (value == null) return "—";
  return `$${value.toFixed(digits)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBucket(iso: string, period: CostPeriod): string {
  const d = new Date(iso);
  if (period === "hour") {
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  if (period === "month") {
    return d.toLocaleString("ru-RU", { month: "long", year: "numeric" });
  }
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CostAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (!isSimplyDevMode) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Доступно только в dev-режиме.</p>
      </div>
    );
  }

  const { preset: presetLabel } = await searchParams;
  const preset = getPreset(presetLabel);

  const [
    invalidUsers,
    lastCronRuns,
    costByPeriod,
    costByChatMode,
    costByModel,
    nullCostRecords,
  ] = await Promise.all([
    getInvalidDeliveryStateUsers(),
    getLastCronRuns(10),
    getCostByPeriod(preset.period, preset.range),
    getCostByChatModeForRange(preset.days),
    getCostByModel(preset.days),
    getNullCostRecordsForRange(preset.days),
  ]);

  const totalCost = costByPeriod.reduce((sum, r) => sum + (r.totalUsd ?? 0), 0);
  const totalNullCount = nullCostRecords.reduce((sum, r) => sum + r.count, 0);
  const maxChatModeCost = Math.max(...costByChatMode.map((r) => r.totalUsd ?? 0), 0.0001);
  const maxModelCost = Math.max(...costByModel.map((r) => r.totalUsd ?? 0), 0.0001);

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background px-4 lg:px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        <h1 className="ml-3 font-serif text-base font-semibold">Cost Audit</h1>
        <Badge variant="outline" className="ml-2 text-xs">dev</Badge>
        <div className="ml-auto">
          <UserMenu align="end" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 p-4 lg:p-6">

        {/* Period selector */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
          {PRESETS.map((p) => {
            const isActive = p.label === preset.label;
            return (
              <Link
                key={p.label}
                href={`?preset=${p.label}`}
                className={
                  isActive
                    ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                }
              >
                {p.label}
              </Link>
            );
          })}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={<DollarSign className="size-5 text-muted-foreground" />}
            label={`Расходы (${preset.label})`}
            value={formatUsd(totalCost)}
            sub={`${costByPeriod.length} ${preset.period === "hour" ? "часов" : preset.period === "day" ? "дней" : "месяцев"} с активностью`}
            status="neutral"
          />
          <SummaryCard
            icon={
              invalidUsers.length === 0
                ? <CheckCircle className="size-5 text-success" />
                : <AlertTriangle className="size-5 text-warning" />
            }
            label="Invalid delivery states"
            value={String(invalidUsers.length)}
            sub={invalidUsers.length === 0 ? "Инвариант соблюдён ✓" : "Нужна починка!"}
            status={invalidUsers.length === 0 ? "ok" : "warn"}
          />
          <SummaryCard
            icon={
              totalNullCount === 0
                ? <CheckCircle className="size-5 text-success" />
                : <AlertTriangle className="size-5 text-warning" />
            }
            label={`NULL costUsd (${preset.label})`}
            value={String(totalNullCount)}
            sub={totalNullCount === 0 ? "100% coverage ✓" : "Есть дыры в логах"}
            status={totalNullCount === 0 ? "ok" : "warn"}
          />
        </div>

        {/* Cost timeline */}
        <Section title={`Расходы по ${preset.period === "hour" ? "часам" : preset.period === "day" ? "дням" : "месяцам"}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Период</th>
                <th className="pb-2 pr-4 text-right font-medium">Вызовов</th>
                <th className="pb-2 text-right font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {costByPeriod.map((row) => (
                <tr key={row.bucket}>
                  <td className="py-2 pr-4 font-mono text-xs">{formatBucket(row.bucket, preset.period)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{row.count}</td>
                  <td className="py-2 text-right tabular-nums">{formatUsd(row.totalUsd)}</td>
                </tr>
              ))}
              {costByPeriod.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted-foreground">Нет данных за этот период</td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* Cost by Model */}
        <Section title="Расходы по моделям и провайдерам">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Модель</th>
                <th className="pb-2 pr-4 text-right font-medium">Вызовов</th>
                <th className="pb-2 pr-4 text-right font-medium">Токены in</th>
                <th className="pb-2 pr-4 text-right font-medium">Токены out</th>
                <th className="pb-2 pr-4 text-right font-medium">Сумма</th>
                <th className="pb-2 font-medium">Доля</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {costByModel.map((row) => {
                const pct = ((row.totalUsd ?? 0) / maxModelCost) * 100;
                return (
                  <tr key={row.modelId}>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <ProviderDot modelId={row.modelId} />
                        <span className="font-mono text-xs">{row.modelId}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{row.count}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{formatTokens(row.inputTokens)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{formatTokens(row.outputTokens)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatUsd(row.totalUsd)}</td>
                    <td className="py-2 w-36">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${pct.toFixed(1)}%` }}
                          />
                        </div>
                        <span className="w-9 text-right text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {costByModel.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-muted-foreground">Нет данных</td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* Cost by ChatMode */}
        <Section title="Расходы по режимам">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Режим</th>
                <th className="pb-2 pr-4 text-right font-medium">Вызовов</th>
                <th className="pb-2 pr-4 text-right font-medium">Сумма</th>
                <th className="pb-2 font-medium">Доля</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {costByChatMode.map((row) => {
                const pct = ((row.totalUsd ?? 0) / maxChatModeCost) * 100;
                return (
                  <tr key={row.chatMode}>
                    <td className="py-2 pr-4 font-mono text-xs">{row.chatMode}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{row.count}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatUsd(row.totalUsd)}</td>
                    <td className="py-2 w-36">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${pct.toFixed(1)}%` }}
                          />
                        </div>
                        <span className="w-9 text-right text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {costByChatMode.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">Нет данных</td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* Null cost records */}
        <Section
          title="Записи без costUsd"
          badge={totalNullCount > 0 ? String(totalNullCount) : undefined}
          badgeVariant={totalNullCount > 0 ? "destructive" : "secondary"}
        >
          {totalNullCount === 0 ? (
            <p className="py-4 text-center text-sm text-success">
              ✓ Все записи за период имеют costUsd
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Режим</th>
                  <th className="pb-2 pr-4 font-medium">Модель</th>
                  <th className="pb-2 text-right font-medium">Кол-во</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nullCostRecords.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 font-mono text-xs">{row.chatMode}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{row.modelId}</td>
                    <td className="py-2 text-right tabular-nums text-warning">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Last Cron Runs */}
        <Section title="Последние запуски cron">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Запуск</th>
                <th className="pb-2 pr-4 text-right font-medium">Длит.</th>
                <th className="pb-2 pr-4 text-right font-medium">Обработано</th>
                <th className="pb-2 pr-4 text-right font-medium">Пропущено</th>
                <th className="pb-2 text-right font-medium">Ошибки</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lastCronRuns.map((run) => (
                <tr key={run.id}>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <Activity className="size-3 text-muted-foreground" />
                      <span className="font-mono text-xs">{formatDate(run.startedAt)}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    <span className="flex items-center justify-end gap-1">
                      <Clock className="size-3" />
                      {formatDuration(run.durationMs)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{run.usersProcessed}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{run.usersSkipped}</td>
                  <td className="py-2 text-right tabular-nums">
                    {run.usersFailed > 0
                      ? <span className="text-warning">{run.usersFailed}</span>
                      : <span className="text-muted-foreground">0</span>
                    }
                  </td>
                </tr>
              ))}
              {lastCronRuns.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">Cron ещё не запускался</td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* Invalid delivery states — only shown when there are issues */}
        {invalidUsers.length > 0 && (
          <Section title="⚠️ Invalid delivery states" badgeVariant="destructive" badge={String(invalidUsers.length)}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">userId</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invalidUsers.map((u) => (
                  <tr key={u.userId}>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{u.userId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <p className="pb-6 text-center text-xs text-muted-foreground">
          Период: {preset.label} · Обновляется при открытии страницы
        </p>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProviderDot({ modelId }: { modelId: string }) {
  let color = "bg-muted-foreground";
  if (modelId.startsWith("claude")) color = "bg-primary";
  else if (modelId.startsWith("gemini") || modelId.startsWith("models/")) color = "bg-info";
  else if (modelId.startsWith("sonar") || modelId.startsWith("deepgram")) color = "bg-warning";
  return <span className={`inline-block size-2 shrink-0 rounded-full ${color}`} />;
}

function SummaryCard({
  icon, label, value, sub, status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  status: "ok" | "warn" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className={
        status === "ok" ? "mt-1 text-xs text-success"
        : status === "warn" ? "mt-1 text-xs text-warning"
        : "mt-1 text-xs text-muted-foreground"
      }>
        {sub}
      </p>
    </div>
  );
}

function Section({
  title, badge, badgeVariant, children,
}: {
  title: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="font-serif text-sm font-semibold">{title}</h2>
        {badge != null && (
          <Badge variant={badgeVariant ?? "secondary"} className="text-xs">{badge}</Badge>
        )}
      </div>
      <div className="overflow-x-auto px-4 py-3">{children}</div>
    </div>
  );
}

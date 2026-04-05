import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, CheckCircle, AlertTriangle, DollarSign, Clock, Activity } from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import { isSimplyDevMode } from "@/lib/constants";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui/badge";
import {
  getInvalidDeliveryStateUsers,
  getLastCronRuns,
  getCostByDay,
  getCostByChatMode,
  getNullCostRecords,
} from "@/lib/db/queries";

function formatUsd(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CostAuditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isSimplyDevMode) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Доступно только в dev-режиме.</p>
      </div>
    );
  }

  const [
    invalidUsers,
    lastCronRuns,
    costByDay,
    costByChatMode,
    nullCostRecords,
  ] = await Promise.all([
    getInvalidDeliveryStateUsers(),
    getLastCronRuns(10),
    getCostByDay(30),
    getCostByChatMode(30),
    getNullCostRecords(30),
  ]);

  const totalCost30d = costByDay.reduce((sum, r) => sum + (r.totalUsd ?? 0), 0);
  const totalNullCount = nullCostRecords.reduce((sum, r) => sum + r.count, 0);
  const maxChatModeCost = Math.max(...costByChatMode.map((r) => r.totalUsd ?? 0), 0.0001);

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
        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={<DollarSign className="size-5 text-muted-foreground" />}
            label="Расходы (30 дней)"
            value={`$${totalCost30d.toFixed(4)}`}
            sub={`${costByDay.length} активных дней`}
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
            label="NULL costUsd (30 дней)"
            value={String(totalNullCount)}
            sub={totalNullCount === 0 ? "100% coverage ✓" : "Есть дыры в логах"}
            status={totalNullCount === 0 ? "ok" : "warn"}
          />
        </div>

        {/* Cost by ChatMode */}
        <Section title="Расходы по режимам (30 дней)">
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
                  <tr key={row.chatMode} className="group">
                    <td className="py-2 pr-4 font-mono text-xs">{row.chatMode}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {row.count}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatUsd(row.totalUsd)}
                    </td>
                    <td className="py-2 w-40">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${pct.toFixed(1)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {costByChatMode.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* Cost by Day */}
        <Section title="Расходы по дням (30 дней)">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Дата</th>
                <th className="pb-2 pr-4 text-right font-medium">Вызовов</th>
                <th className="pb-2 text-right font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {costByDay.map((row) => (
                <tr key={row.day}>
                  <td className="py-2 pr-4 font-mono text-xs">{row.day}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {row.count}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatUsd(row.totalUsd)}</td>
                </tr>
              ))}
              {costByDay.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted-foreground">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* Null cost records */}
        <Section
          title="Записи без costUsd (30 дней)"
          badge={totalNullCount > 0 ? String(totalNullCount) : undefined}
          badgeVariant={totalNullCount > 0 ? "destructive" : "secondary"}
        >
          {totalNullCount === 0 ? (
            <p className="py-4 text-center text-sm text-success">
              ✓ Все записи за последние 30 дней имеют costUsd
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
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                      {row.modelId}
                    </td>
                    <td className="py-2 text-right tabular-nums text-warning">
                      {row.count}
                    </td>
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
                      <span className="font-mono text-xs">
                        {formatDate(run.startedAt)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    <span className="flex items-center justify-end gap-1">
                      <Clock className="size-3" />
                      {formatDuration(run.durationMs)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {run.usersProcessed}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {run.usersSkipped}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {run.usersFailed > 0 ? (
                      <span className="text-warning">{run.usersFailed}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
              {lastCronRuns.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">
                    Cron ещё не запускался
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* Invalid delivery states */}
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
          Данные за последние 30 дней · Обновлено при каждом открытии страницы
        </p>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  label,
  value,
  sub,
  status,
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
      <p
        className={
          status === "ok"
            ? "mt-1 text-xs text-success"
            : status === "warn"
              ? "mt-1 text-xs text-warning"
              : "mt-1 text-xs text-muted-foreground"
        }
      >
        {sub}
      </p>
    </div>
  );
}

function Section({
  title,
  badge,
  badgeVariant,
  children,
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
          <Badge variant={badgeVariant ?? "secondary"} className="text-xs">
            {badge}
          </Badge>
        )}
      </div>
      <div className="overflow-x-auto px-4 py-3">{children}</div>
    </div>
  );
}

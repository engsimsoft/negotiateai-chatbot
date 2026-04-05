// ТЗ-COSTCTRL Phase 6: Admin cost-audit endpoint
// Gated by SIMPLY_DEV_MODE=true — returns 403 in production

import { NextResponse } from "next/server";
import { isSimplyDevMode } from "@/lib/constants";
import {
  getInvalidDeliveryStateUsers,
  getLastCronRuns,
  getCostByDay,
  getCostByChatMode,
  getNullCostRecords,
} from "@/lib/db/queries";

export async function GET() {
  if (!isSimplyDevMode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    invalidDeliveryUsers,
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

  const totalCostUsd30d = costByDay.reduce(
    (sum, r) => sum + (r.totalUsd ?? 0),
    0,
  );
  const totalNullCount30d = nullCostRecords.reduce(
    (sum, r) => sum + r.count,
    0,
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    invariants: {
      invalidDeliveryUsers,
      invalidDeliveryCount: invalidDeliveryUsers.length,
    },
    cron: {
      lastRuns: lastCronRuns,
    },
    costs: {
      totalUsd30d: Math.round(totalCostUsd30d * 1_000_000) / 1_000_000,
      byDay: costByDay,
      byChatMode: costByChatMode,
    },
    nullCost: {
      totalCount30d: totalNullCount30d,
      byModel: nullCostRecords,
    },
  });
}

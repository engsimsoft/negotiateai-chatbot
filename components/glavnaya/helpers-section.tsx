"use client";

import Link from "next/link";
import { Wrench } from "lucide-react";
import useSWR from "swr";
import { SectionTitle } from "./section-title";
import { fetcher } from "@/lib/utils";
import type { PresetHelper, CustomHelper, HelpersListResponse } from "@/lib/helpers";

interface HelperCardProps {
  helper: PresetHelper | CustomHelper;
  isCustom?: boolean;
}

function HelperCard({ helper, isCustom }: HelperCardProps) {
  return (
    <Link
      href={`/helpers/${helper.id}/chat`}
      className={`flex items-start gap-3.5 rounded-xl border p-4 transition-all hover:border-primary hover:shadow-sm ${
        isCustom ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20" : "bg-background"
      }`}
    >
      <div className="mt-0.5 shrink-0 text-2xl">
        {helper.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{helper.name}</span>
          {isCustom && (
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              свой
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {helper.type === "preset" ? (helper as PresetHelper).description : (helper as CustomHelper).instruction || "Кастомный помощник"}
        </div>
      </div>
    </Link>
  );
}

function ConstructorCard() {
  return (
    <Link
      href="/helpers/new"
      className="flex items-start gap-3.5 rounded-xl border border-sky-200 bg-sky-50 p-4 transition-all hover:border-primary hover:shadow-sm dark:border-sky-900/50 dark:bg-sky-950/20"
    >
      <div className="mt-0.5 shrink-0 text-2xl">
        <Wrench className="size-6 text-sky-600 dark:text-sky-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Конструктор</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Создайте помощника под свою задачу
        </div>
      </div>
    </Link>
  );
}

export function HelpersSection() {
  const { data, isLoading } = useSWR<HelpersListResponse>(
    "/api/helpers",
    fetcher
  );

  if (isLoading) {
    return (
      <section className="mb-10">
        <SectionTitle>Помощники</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-[88px] animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </section>
    );
  }

  const presets = data?.presets || [];
  const custom = data?.custom || [];
  const totalCount = presets.length + custom.length;

  return (
    <section className="mb-10">
      <SectionTitle count={totalCount}>Помощники</SectionTitle>

      {/* Custom helpers first (more important to user) */}
      {custom.length > 0 && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {custom.map((helper) => (
            <HelperCard key={helper.id} helper={helper} isCustom />
          ))}
        </div>
      )}

      {/* Preset helpers + Constructor */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {presets.map((helper) => (
          <HelperCard key={helper.id} helper={helper} />
        ))}
        <ConstructorCard />
      </div>
    </section>
  );
}

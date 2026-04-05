"use client";

/**
 * Briefing Delivery Settings
 *
 * Toggle auto-generation, time picker, format selector.
 * Requires Telegram connection to enable.
 *
 * ТЗ-TG4a Этап 4
 */

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { Clock, MessageCircle, Send } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/toast";
import { fetcher } from "@/lib/utils";

interface DeliveryData {
  deliveryEnabled: boolean;
  deliveryFormat: string;
  generationTime: string;
  timezone: string;
  telegramConnected: boolean;
  telegramUsername: string | null;
}

// Generate time options (every 30 min)
const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    TIME_OPTIONS.push({ value: val, label: val });
  }
}

const FORMAT_OPTIONS = [
  { value: "text", label: "Только текст" },
  { value: "audio", label: "Только аудио" },
  { value: "text_audio", label: "Текст + аудио" },
];

export function BriefingDeliverySettings() {
  const { data, mutate } = useSWR<DeliveryData>(
    "/api/briefing/delivery",
    fetcher,
  );

  const [saving, setSaving] = useState(false);

  // Local state for optimistic updates
  const [enabled, setEnabled] = useState(false);
  const [format, setFormat] = useState("text_audio");
  const [time, setTime] = useState("07:00");

  // Sync local state with fetched data
  useEffect(() => {
    if (data) {
      setEnabled(data.deliveryEnabled);
      setFormat(data.deliveryFormat);
      setTime(data.generationTime);
    }
  }, [data]);

  const patchSetting = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch("/api/briefing/delivery", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (res.status === 409) {
          // Invariant violation — revert optimistic state and show toast
          if (data) {
            setEnabled(data.deliveryEnabled);
            setFormat(data.deliveryFormat);
            setTime(data.generationTime);
          }
          toast({
            type: "error",
            description: "Подключите Telegram в настройках для автоматической доставки",
          });
          return;
        }
        if (!res.ok) throw new Error("Save failed");
        const updated = await res.json();
        mutate(
          (prev) => (prev ? { ...prev, ...updated } : prev),
          false,
        );
      } catch {
        toast({ type: "error", description: "Не удалось сохранить настройки" });
        // Revert local state
        if (data) {
          setEnabled(data.deliveryEnabled);
          setFormat(data.deliveryFormat);
          setTime(data.generationTime);
        }
      } finally {
        setSaving(false);
      }
    },
    [data, mutate],
  );

  const handleToggle = useCallback(
    (checked: boolean) => {
      setEnabled(checked);
      patchSetting({ deliveryEnabled: checked });
    },
    [patchSetting],
  );

  const handleFormatChange = useCallback(
    (val: string) => {
      setFormat(val);
      patchSetting({ deliveryFormat: val });
    },
    [patchSetting],
  );

  const handleTimeChange = useCallback(
    (val: string) => {
      setTime(val);
      patchSetting({ generationTime: val });
    },
    [patchSetting],
  );

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
      </div>
    );
  }

  const telegramOk = data.telegramConnected;
  // Escape hatch: user can always turn delivery OFF (even without Telegram).
  // Turning ON requires active Telegram — enforced by API (409) + disabled state.
  const switchDisabled = saving || (!telegramOk && !enabled);
  const showTelegramTooltip = !telegramOk && !enabled;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Автоматическая доставка</h3>
      </div>

      {/* Telegram status */}
      {!telegramOk && (
        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <div className="flex items-start gap-2">
            <MessageCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium">Telegram не подключён</p>
              <p className="mt-0.5">
                Для автоматической доставки брифинга подключите Telegram в{" "}
                <a
                  href="/settings"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  настройках
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <Label
          htmlFor="delivery-toggle"
          className={switchDisabled ? "text-muted-foreground/50" : ""}
        >
          Доставлять каждое утро
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={showTelegramTooltip ? 0 : undefined}>
                <Switch
                  id="delivery-toggle"
                  checked={enabled}
                  onCheckedChange={handleToggle}
                  disabled={switchDisabled}
                />
              </span>
            </TooltipTrigger>
            {showTelegramTooltip && (
              <TooltipContent side="left">
                <p>Подключите Telegram чтобы включить доставку</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Time picker */}
      <div className="space-y-1.5">
        <Label
          className={!enabled || switchDisabled ? "text-muted-foreground/50" : ""}
        >
          <Clock className="mr-1.5 inline h-3.5 w-3.5" />
          Время доставки
        </Label>
        <Select
          value={time}
          onValueChange={handleTimeChange}
          disabled={!enabled || switchDisabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data.timezone && (
          <p className="text-[10px] text-muted-foreground">
            Часовой пояс: {data.timezone}
          </p>
        )}
      </div>

      {/* Format selector */}
      <div className="space-y-1.5">
        <Label
          className={!enabled || switchDisabled ? "text-muted-foreground/50" : ""}
        >
          Формат
        </Label>
        <Select
          value={format}
          onValueChange={handleFormatChange}
          disabled={!enabled || switchDisabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Connected Telegram info */}
      {telegramOk && data.telegramUsername && (
        <p className="text-[10px] text-muted-foreground">
          Telegram: @{data.telegramUsername}
        </p>
      )}
    </div>
  );
}

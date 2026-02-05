"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ТЗ-07C3: Модалка Менеджера проекта (заглушка)
 * Показывает превью будущих функций
 */
export function ManagerDialog({ open, onOpenChange }: ManagerDialogProps) {
  const actions = [
    { icon: "📁", label: "Разобрать файлы", description: "Организовать по папкам" },
    { icon: "📊", label: "Подвести итог", description: "Сводка проекта" },
    { icon: "📝", label: "Изменить инструкцию", description: "Цели и контекст" },
    { icon: "📋", label: "Разбить на задачи", description: "Декомпозиция" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>👤</span>
            <span>Менеджер проекта</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Чем помочь?</p>

          {/* 4 карточки действий (2x2) */}
          <div className="grid grid-cols-2 gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-3 opacity-50 cursor-not-allowed"
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-xs font-medium text-center">
                  {action.label}
                </span>
              </button>
            ))}
          </div>

          {/* Поле ввода (заблокировано) */}
          <Input
            disabled
            placeholder="Или опишите что нужно..."
            className="opacity-50"
          />

          {/* Текст о будущем обновлении */}
          <p className="text-xs text-center text-muted-foreground">
            Менеджер проекта появится в ближайшем обновлении
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

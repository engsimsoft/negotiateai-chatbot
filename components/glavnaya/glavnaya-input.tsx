"use client";

import { CompactInput } from "@/components/input";

/**
 * GlavnayaInput — поле ввода на главной странице
 *
 * Использует CompactInput с provider="google"
 * ТЗ-KITT: При отправке редиректит в /simply (persistent chat)
 */

export function GlavnayaInput() {
  return (
    <CompactInput
      provider="google"
      redirectPath="/simply"
      placeholder="Спросите что угодно..."
    />
  );
}

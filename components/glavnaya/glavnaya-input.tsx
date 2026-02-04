"use client";

import { CompactInput } from "@/components/input";

/**
 * GlavnayaInput — поле ввода на главной странице
 *
 * Использует CompactInput с provider="google"
 * При отправке редиректит в /chat
 */

export function GlavnayaInput() {
  return (
    <CompactInput
      provider="google"
      redirectPath="/chat"
      placeholder="Спросите что угодно..."
    />
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  ServiceChatTrigger,
  ServiceChatFloating,
  BEN_CONFIG,
} from "@/components/service-chat";
import { UserMenu } from "@/components/user-menu";

export function GlavnayaHeader() {
  const [benOpen, setBenOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Logo */}
      <Link href="/dashboard" className="text-xl font-semibold tracking-tight">
        Simply
      </Link>

      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Ben trigger */}
        <ServiceChatTrigger
          icon={<HelpCircle className="h-5 w-5" />}
          tooltip="Бен, help"
          onClick={() => setBenOpen(true)}
        />

        {/* User menu */}
        <UserMenu />
      </div>

      {/* Ben floating modal */}
      <ServiceChatFloating
        config={BEN_CONFIG}
        open={benOpen}
        onOpenChange={setBenOpen}
      />
    </header>
  );
}

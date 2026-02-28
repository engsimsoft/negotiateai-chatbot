"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { ListDetailPage } from "@/components/list-detail";
import { toast } from "@/components/toast";
import { GroupList } from "./group-list";
import { GroupDetail } from "./group-detail";

export type GroupClient = {
  id: string;
  telegramChatId: number;
  title: string;
  type: string;
  isForum: boolean;
  ownerUserId: string | null;
  isActive: boolean;
  memberCount: number | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessageAt: Date | null;
};

function groupCountLabel(count: number): string {
  if (count === 1) return "группа";
  if (count >= 2 && count <= 4) return "группы";
  return "групп";
}

interface GroupsPageProps {
  initialGroups: GroupClient[];
  emptyState: {
    icon: ReactNode;
    title: string;
    description: string;
  };
}

export function GroupsPage({ initialGroups, emptyState }: GroupsPageProps) {
  const [groups, setGroups] = useState<GroupClient[]>(initialGroups);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialGroups.length > 0 ? initialGroups[0].id : null,
  );

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  const handleDeactivate = async (groupId: string) => {
    try {
      const res = await fetch(`/api/telegram/groups/${groupId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to deactivate");

      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, isActive: false } : g)),
      );
      toast({ type: "success", description: "Группа отключена" });
    } catch {
      toast({ type: "error", description: "Не удалось отключить группу" });
    }
  };

  return (
    <ListDetailPage
      title="Группы Telegram"
      itemCount={groups.length}
      itemCountLabel={groupCountLabel}
      emptyState={emptyState}
      isEmpty={groups.length === 0}
      listContent={
        <GroupList
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          onDeactivate={handleDeactivate}
        />
      }
      detailContent={
        <GroupDetail
          group={selectedGroup}
          onDeactivate={handleDeactivate}
        />
      }
    />
  );
}

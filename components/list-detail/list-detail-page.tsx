"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";

interface CreateButtonLink {
  label: string;
  href: string;
}

interface CreateButtonAction {
  label: string;
  onClick: () => void;
}

export interface ListDetailPageProps {
  /** Page title shown in header */
  title: string;
  /** Number of items (shown as subtitle) */
  itemCount: number;
  /** Function to format count label, e.g. (n) => "чатов" */
  itemCountLabel: (count: number) => string;
  /** Create button config — link or action */
  createButton?: CreateButtonLink | CreateButtonAction;
  /** Empty state config */
  emptyState: {
    icon: ReactNode;
    title: string;
    description: string;
  };
  /** Whether the list is empty */
  isEmpty: boolean;
  /** Left column content (list) */
  listContent: ReactNode;
  /** Right column content (detail panel) */
  detailContent: ReactNode;
}

/**
 * ListDetailPage — universal two-column layout shell
 *
 * Composition component: layout only, content via props.
 * Used by /chats, /expertise, /create, /projects.
 */
export function ListDetailPage({
  title,
  itemCount,
  itemCountLabel,
  createButton,
  emptyState,
  isEmpty,
  listContent,
  detailContent,
}: ListDetailPageProps) {
  const router = useRouter();

  const handleCreateClick = () => {
    if (!createButton) return;
    if ("href" in createButton) {
      router.push(createButton.href);
    } else {
      createButton.onClick();
    }
  };

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      {/* Header — design-system pattern */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button size="icon" variant="ghost">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">
              {itemCount} {itemCountLabel(itemCount)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {createButton && (
            <Button size="sm" onClick={handleCreateClick}>
              <Plus className="mr-1 size-4" />
              {createButton.label}
            </Button>
          )}
          <UserMenu />
        </div>
      </header>

      {/* Content */}
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            {emptyState.icon}
          </div>
          <h2 className="mb-2 text-lg font-semibold">{emptyState.title}</h2>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            {emptyState.description}
          </p>
          {createButton && (
            <Button onClick={handleCreateClick}>
              <Plus className="mr-1 size-4" />
              {createButton.label}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-1">
          {/* Left column: list */}
          <div className="w-full border-r md:w-80 lg:w-96">
            {listContent}
          </div>

          {/* Right column: detail (hidden on mobile) */}
          <div className="hidden flex-1 md:block">
            {detailContent}
          </div>
        </div>
      )}
    </div>
  );
}

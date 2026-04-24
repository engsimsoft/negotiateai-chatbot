import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import { UserMenu } from "@/components/user-menu";
import { DocumentSplitView } from "@/components/library/document-split-view";
import { getLibraryDocumentById } from "@/lib/ai/library/db";
import { generateUUID } from "@/lib/utils";

export default async function LibraryDocumentPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { docId } = await params;
  const doc = await getLibraryDocumentById(docId);
  if (!doc || doc.userId !== session.user.id) {
    notFound();
  }

  const chatId = generateUUID();

  return (
    <div className="flex h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center border-b bg-background px-4 lg:px-6">
        <Link
          href="/library"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Библиотека</span>
        </Link>
        <h1 className="ml-3 truncate font-serif text-base font-semibold">
          {doc.filename}
        </h1>
        <div className="ml-auto">
          <UserMenu align="end" />
        </div>
      </header>

      <DocumentSplitView
        chatId={chatId}
        documentId={doc.id}
        filename={doc.filename}
        mimeType={doc.mimeType}
        size={doc.size}
        autoType={doc.autoType}
        autoTags={doc.autoTags}
        autoDescription={doc.autoDescription}
        autoSummary={doc.autoSummary}
        createdAt={doc.createdAt.toISOString()}
      />
    </div>
  );
}

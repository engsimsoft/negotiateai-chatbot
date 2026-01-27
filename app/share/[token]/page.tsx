import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicDocument } from "@/lib/db/queries";
import { SharedDocumentView } from "./shared-document-view";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const document = await getPublicDocument({ token });

  if (!document) {
    return {
      title: "Document Not Found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: document.title,
    robots: { index: false, follow: false },
  };
}

export default async function SharedDocumentPage({ params }: Props) {
  const { token } = await params;
  const document = await getPublicDocument({ token });

  if (!document) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <SharedDocumentView document={document} />
    </div>
  );
}

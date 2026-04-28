"use client";

import equal from "fast-deep-equal";
import {
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useArtifact } from "@/hooks/use-artifact";
import type { ArtifactKind, UIArtifact } from "./artifact";
import { DocumentToolCall, DocumentToolResult } from "./document";
import { FileIcon, ImageIcon, LoaderIcon } from "./icons";

// Get document format label based on kind
function getDocumentFormatLabel(kind: ArtifactKind): string {
  switch (kind) {
    case "markdown":
      return "Документ · MD";
    case "text":
      return "Текст · TXT";
    case "presentation-reveal":
      return "Презентация · HTML";
    case "presentation-pptx":
      return "Презентация · PPTX";
    case "image":
      return "Изображение";
    default:
      return "Документ";
  }
}

type DocumentPreviewProps = {
  isReadonly: boolean;
  result?: any;
  args?: any;
};

export function DocumentPreview({
  isReadonly,
  result,
  args,
}: DocumentPreviewProps) {
  const { artifact, setArtifact } = useArtifact();
  const hitboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundingBox = hitboxRef.current?.getBoundingClientRect();

    if (artifact.documentId && boundingBox) {
      setArtifact((currentArtifact) => ({
        ...currentArtifact,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    }
  }, [artifact.documentId, setArtifact]);

  if (artifact.isVisible) {
    if (result) {
      return (
        <DocumentToolResult
          isReadonly={isReadonly}
          result={{ id: result.id, title: result.title, kind: result.kind }}
          type="create"
        />
      );
    }

    if (args) {
      return (
        <DocumentToolCall
          args={{ title: args.title, kind: args.kind }}
          isReadonly={isReadonly}
          type="create"
        />
      );
    }
  }

  const title =
    result?.title ??
    args?.title ??
    (artifact.status === "streaming" ? artifact.title : undefined);
  const kind: ArtifactKind | undefined =
    result?.kind ??
    args?.kind ??
    (artifact.status === "streaming" ? artifact.kind : undefined);

  if (!(title && kind)) {
    return <LoadingSkeleton artifactKind={artifact.kind} />;
  }

  return (
    <div className="relative w-fit cursor-pointer">
      <HitboxLayer
        hitboxRef={hitboxRef}
        result={result}
        setArtifact={setArtifact}
      />
      <CompactDocumentCard
        isStreaming={artifact.status === "streaming"}
        kind={kind}
        title={title}
      />
    </div>
  );
}

// Compact loading skeleton (Anthropic style)
const LoadingSkeleton = ({ artifactKind }: { artifactKind: ArtifactKind }) => (
  <div className="flex w-fit items-center gap-3 rounded-xl border bg-background px-4 py-3 dark:bg-muted">
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted dark:bg-accent">
      <div className="size-5 animate-pulse rounded bg-muted-foreground/30" />
    </div>
    <div className="flex flex-col gap-1">
      <div className="h-4 w-32 animate-pulse rounded bg-muted-foreground/20" />
      <div className="h-3 w-20 animate-pulse rounded bg-muted-foreground/15" />
    </div>
  </div>
);

// Compact document card (Anthropic style)
const PureCompactDocumentCard = ({
  title,
  kind,
  isStreaming,
}: {
  title: string;
  kind: ArtifactKind;
  isStreaming: boolean;
}) => (
  <div className="flex w-fit items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-colors hover:bg-muted/50 dark:bg-muted dark:hover:bg-accent">
    {/* Document icon */}
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted dark:bg-accent">
      {isStreaming ? (
        <div className="animate-spin text-muted-foreground">
          <LoaderIcon size={20} />
        </div>
      ) : kind === "image" ? (
        <ImageIcon size={20} />
      ) : (
        <FileIcon size={20} />
      )}
    </div>
    {/* Title and format */}
    <div className="flex flex-col">
      <span className="font-medium text-foreground">{title}</span>
      <span className="text-sm text-muted-foreground">
        {getDocumentFormatLabel(kind)}
      </span>
    </div>
  </div>
);

const CompactDocumentCard = memo(PureCompactDocumentCard, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) return false;
  if (prevProps.kind !== nextProps.kind) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  return true;
});

const PureHitboxLayer = ({
  hitboxRef,
  result,
  setArtifact,
}: {
  hitboxRef: React.RefObject<HTMLDivElement | null>;
  result: any;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)
  ) => void;
}) => {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const boundingBox = event.currentTarget.getBoundingClientRect();

      setArtifact((artifact) =>
        artifact.status === "streaming"
          ? { ...artifact, isVisible: true }
          : {
              ...artifact,
              title: result.title,
              documentId: result.id,
              kind: result.kind,
              isVisible: true,
              boundingBox: {
                left: boundingBox.x,
                top: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
              },
            }
      );
    },
    [setArtifact, result]
  );

  return (
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 z-10 size-full rounded-xl"
      onClick={handleClick}
      ref={hitboxRef}
      role="presentation"
    />
  );
};

const HitboxLayer = memo(PureHitboxLayer, (prevProps, nextProps) => {
  if (!equal(prevProps.result, nextProps.result)) {
    return false;
  }
  return true;
});

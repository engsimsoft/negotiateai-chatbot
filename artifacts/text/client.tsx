import { motion } from "framer-motion";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { DiffView } from "@/components/diffview";
import { DocumentSkeleton } from "@/components/document-skeleton";
import {
  ClockRewind,
  CopyIcon,
  DownloadIcon,
  RedoIcon,
  ShareIcon,
  SparklesIcon,
  UndoIcon,
} from "@/components/icons";
import { PlainTextEditor } from "@/components/plain-text-editor";

type TextArtifactMetadata = Record<string, never>;

export const textArtifact = new Artifact<"text", TextArtifactMetadata>({
  kind: "text",
  description: "Plain text for social media posts (VK, Telegram, Instagram).",
  initialize: () => null,
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-textDelta") {
      setArtifact((draftArtifact) => {
        return {
          ...draftArtifact,
          content: draftArtifact.content + streamPart.data,
          // Open artifact immediately when streaming starts (shows Code Rain first)
          isVisible: true,
          status: "streaming",
        };
      });
    }
  },
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
  }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    if (mode === "diff") {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      return <DiffView newContent={newContent} oldContent={oldContent} />;
    }

    const isStreaming = status === "streaming";

    // Show Code Rain animation while content is being generated (first ~200 chars)
    if (isStreaming && (!content || content.length < 200)) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    return (
      <div className="relative flex flex-col w-full h-full px-4 py-8 md:px-12">
        <PlainTextEditor
          content={content}
          isCurrentVersion={isCurrentVersion}
          onSaveContent={onSaveContent}
          status={status}
        />

        {/* Streaming indicator */}
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="sticky bottom-4 left-0 right-0 flex justify-center pointer-events-none"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full border border-primary/20 shadow-lg">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <SparklesIcon size={16} />
              </motion.div>
              <span className="text-sm font-medium text-primary">
                Генерация текста...
              </span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                    className="size-1.5 rounded-full bg-primary"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  },
  actions: [
    {
      icon: <ClockRewind size={18} />,
      description: "View changes",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("toggle");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: "Download as .txt",
      onClick: ({ content }) => {
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "document.txt";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Downloaded!");
      },
    },
    {
      icon: <ShareIcon size={18} />,
      description: "Share document",
      onClick: ({ openShareModal }) => {
        openShareModal();
      },
    },
  ],
  toolbar: [],
});

"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";

type PlainTextEditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
};

function PurePlainTextEditor({
  content,
  onSaveContent,
  status,
  isCurrentVersion,
}: PlainTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localContent, setLocalContent] = useState(content);

  // Sync content from props when streaming or external update
  useEffect(() => {
    if (status === "streaming" || localContent !== content) {
      setLocalContent(content);
    }
  }, [content, status]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [localContent]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setLocalContent(newContent);
      onSaveContent(newContent, true); // debounce = true
    },
    [onSaveContent]
  );

  const isReadOnly = status === "streaming" || !isCurrentVersion;

  return (
    <textarea
      ref={textareaRef}
      value={localContent}
      onChange={handleChange}
      readOnly={isReadOnly}
      className="w-full min-h-[400px] p-4 text-base leading-relaxed bg-transparent border-0 outline-none resize-none focus:ring-0 whitespace-pre-wrap"
      placeholder="Text content will appear here..."
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    />
  );
}

function areEqual(
  prevProps: PlainTextEditorProps,
  nextProps: PlainTextEditorProps
) {
  return (
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
    prevProps.content === nextProps.content &&
    prevProps.onSaveContent === nextProps.onSaveContent
  );
}

export const PlainTextEditor = memo(PurePlainTextEditor, areEqual);

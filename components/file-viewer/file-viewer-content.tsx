"use client";

import type { FileRendererProps } from "./types";
import { getFileType } from "./utils";
import { ImageRenderer } from "./renderers/image-renderer";
import { PdfRenderer } from "./renderers/pdf-renderer";
import { TextRenderer } from "./renderers/text-renderer";
import { MarkdownRenderer } from "./renderers/markdown-renderer";
import { CsvRenderer } from "./renderers/csv-renderer";
import { ExtractedContentRenderer } from "./renderers/extracted-content-renderer";
import { UnsupportedRenderer } from "./renderers/unsupported-renderer";

/**
 * FileViewerContent — выбор рендерера по типу файла
 *
 * Switch по типу файла:
 * - image → ImageRenderer
 * - pdf → PdfRenderer
 * - text → TextRenderer
 * - markdown → MarkdownRenderer
 * - csv → CsvRenderer
 * - excel/presentation → ExtractedContentRenderer
 * - остальные → UnsupportedRenderer
 */
export function FileViewerContent({ file, onLoad, onError }: FileRendererProps) {
  const fileType = getFileType(file);

  switch (fileType) {
    case "image":
      return <ImageRenderer file={file} onLoad={onLoad} onError={onError} />;

    case "pdf":
      return <PdfRenderer file={file} onLoad={onLoad} onError={onError} />;

    case "text":
      return <TextRenderer file={file} onLoad={onLoad} onError={onError} />;

    case "markdown":
      return <MarkdownRenderer file={file} onLoad={onLoad} onError={onError} />;

    case "csv":
      return <CsvRenderer file={file} onLoad={onLoad} onError={onError} />;

    case "excel":
    case "presentation":
      return <ExtractedContentRenderer file={file} onLoad={onLoad} onError={onError} />;

    default:
      return <UnsupportedRenderer file={file} onLoad={onLoad} onError={onError} />;
  }
}

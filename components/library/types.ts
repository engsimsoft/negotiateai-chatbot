export interface DocumentItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: "uploading" | "processing" | "ready" | "error";
  statusError: string | null;
  autoType: string | null;
  autoTags: string[] | null;
  autoDescription: string | null;
  originalFileUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  emoji: string | null;
  sortOrder: number;
  documentCount: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

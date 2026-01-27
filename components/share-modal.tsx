"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CopyIcon, CrossIcon, CheckIcon } from "./icons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
}

type ShareState = {
  isLoading: boolean;
  isShared: boolean;
  shareUrl: string | null;
};

export function ShareModal({ isOpen, onClose, documentId }: ShareModalProps) {
  const [state, setState] = useState<ShareState>({
    isLoading: false,
    isShared: false,
    shareUrl: null,
  });
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    setState((s) => ({ ...s, isLoading: true }));

    try {
      const response = await fetch(`/api/document/${documentId}/share`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to share document");
      }

      const data = await response.json();
      setState({
        isLoading: false,
        isShared: true,
        shareUrl: data.shareUrl,
      });
      toast.success(data.alreadyShared ? "Link copied!" : "Document shared!");
    } catch (error) {
      setState((s) => ({ ...s, isLoading: false }));
      toast.error(error instanceof Error ? error.message : "Failed to share");
    }
  };

  const handleUnshare = async () => {
    setState((s) => ({ ...s, isLoading: true }));

    try {
      const response = await fetch(`/api/document/${documentId}/share`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unshare document");
      }

      setState({
        isLoading: false,
        isShared: false,
        shareUrl: null,
      });
      toast.success("Document is now private");
    } catch (error) {
      setState((s) => ({ ...s, isLoading: false }));
      toast.error(error instanceof Error ? error.message : "Failed to unshare");
    }
  };

  const handleCopyLink = async () => {
    if (state.shareUrl) {
      await navigator.clipboard.writeText(state.shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setState({ isLoading: false, isShared: false, shareUrl: null });
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Share Document</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <CrossIcon size={16} />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status:</span>
            <span className={state.isShared ? "text-green-500 font-medium" : "text-muted-foreground"}>
              {state.isShared ? "Public" : "Private"}
            </span>
          </div>

          {/* Share URL Input (only when shared) */}
          {state.isShared && state.shareUrl && (
            <div className="flex gap-2">
              <Input
                readOnly
                value={state.shareUrl}
                className="flex-1 bg-muted text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {!state.isShared ? (
              <Button
                onClick={handleShare}
                disabled={state.isLoading}
                className="flex-1"
              >
                {state.isLoading ? "Creating link..." : "Create Public Link"}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  className="flex-1"
                >
                  Copy Link
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleUnshare}
                  disabled={state.isLoading}
                  className="flex-1"
                >
                  {state.isLoading ? "..." : "Unshare"}
                </Button>
              </>
            )}
          </div>

          {/* Note */}
          <p className="text-xs text-muted-foreground">
            Anyone with the link can view this document without logging in.
          </p>
        </div>
      </div>
    </div>
  );
}

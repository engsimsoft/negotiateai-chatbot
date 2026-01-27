import Link from "next/link";

export default function SharedDocumentNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-semibold">Document Not Found</h1>
      <p className="text-muted-foreground text-center max-w-md">
        This shared link is no longer available. The document may have been
        deleted or the sharing was revoked by its owner.
      </p>
      <Link
        href="/"
        className="mt-4 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Go to Home
      </Link>
    </div>
  );
}

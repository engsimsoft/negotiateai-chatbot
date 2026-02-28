// Merge individual MP3 tracks into a single podcast file.
// MP3 is a streaming format — concatenation of valid MP3 files produces a valid MP3.

import "server-only";

import { put } from "@vercel/blob";

/**
 * Fetch individual MP3 tracks, concatenate in section order, upload to Vercel Blob.
 *
 * @param userId - User ID (for blob path)
 * @param audioUrls - Map of topicId → MP3 URL
 * @param audioDurations - Map of topicId → duration in seconds
 * @param sectionOrder - topicId[] in article.sections order
 * @returns Combined MP3 URL + total duration
 */
export async function mergeAndUploadPodcast({
  userId,
  audioUrls,
  audioDurations,
  sectionOrder,
}: {
  userId: string;
  audioUrls: Record<string, string>;
  audioDurations: Record<string, number>;
  sectionOrder: string[];
}): Promise<{ url: string; totalDuration: number }> {
  // Fetch tracks in section order
  const buffers: Buffer[] = [];
  let totalDuration = 0;

  for (const topicId of sectionOrder) {
    const url = audioUrls[topicId];
    if (!url) continue;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(
        `[audio-merger] Failed to fetch track ${topicId}: ${res.status}`,
      );
      continue;
    }

    buffers.push(Buffer.from(await res.arrayBuffer()));
    totalDuration += audioDurations[topicId] ?? 0;
  }

  if (buffers.length === 0) {
    throw new Error("No audio tracks available for merging");
  }

  // Concatenate MP3 buffers
  const combined = Buffer.concat(buffers);

  // Upload to Vercel Blob
  const timestamp = Date.now();
  const blobPath = `briefing-podcast/${userId}/combined-${timestamp}.mp3`;

  const blob = await put(blobPath, combined, {
    access: "public",
    contentType: "audio/mpeg",
  });

  console.log(
    `[audio-merger] Merged ${buffers.length} tracks, ${Math.round(totalDuration / 60)}min, ${(combined.length / 1024 / 1024).toFixed(1)}MB`,
  );

  return { url: blob.url, totalDuration };
}

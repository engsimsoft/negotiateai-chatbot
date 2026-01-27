/**
 * Stream resume endpoint
 *
 * NOTE: Resumable streams have been disabled as the feature was removed.
 * This endpoint now returns 204 (No Content) to maintain API compatibility.
 *
 * If resumable streams are needed in the future, consider:
 * - Re-implementing with Redis or similar distributed cache
 * - Using WebSocket for better real-time support
 */
export async function GET() {
  // Resumable streams are disabled, return No Content
  return new Response(null, { status: 204 });
}

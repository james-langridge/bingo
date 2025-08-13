import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// IMPORTANT: Use Node.js runtime, not Edge
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes on Pro plan, 10 seconds on Hobby

export async function GET(
  request: Request,
  { params }: { params: { code: string } },
) {
  const { code } = params;
  const encoder = new TextEncoder();

  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Track last sent data to avoid duplicate sends
  let lastGameData: string | null = null;
  let lastOnlineCount = 0;

  // Function to check and send updates
  const checkForUpdates = async () => {
    try {
      const gameData = await redis.get(`game:${code}`);

      if (!gameData) {
        writer.write(encoder.encode(`data: {"error":"Game not found"}\n\n`));
        return;
      }

      const game =
        typeof gameData === "string" ? JSON.parse(gameData) : gameData;

      // Calculate active players
      const now = Date.now();
      const onlineCount =
        game.players?.filter((p: any) => now - (p.lastSeenAt || 0) < 15000)
          .length || 0;

      // Create a version string to detect changes
      const currentData = JSON.stringify({
        ...game,
        onlineCount,
      });

      // Only send if data changed
      if (currentData !== lastGameData) {
        writer.write(encoder.encode(`data: ${currentData}\n\n`));
        lastGameData = currentData;

        // Log player count changes for debugging
        if (onlineCount !== lastOnlineCount) {
          console.log(
            `[SSE] Game ${code}: Online players changed ${lastOnlineCount} -> ${onlineCount}`,
          );
          lastOnlineCount = onlineCount;
        }
      }
    } catch (error) {
      console.error(`[SSE] Error checking updates for game ${code}:`, error);
    }
  };

  // Send initial state immediately
  await checkForUpdates();

  // Poll for changes every 500ms
  const pollInterval = setInterval(checkForUpdates, 500);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    writer.write(encoder.encode(":heartbeat\n\n"));
  }, 30000);

  // Cleanup on client disconnect
  request.signal.addEventListener("abort", () => {
    clearInterval(pollInterval);
    clearInterval(heartbeatInterval);
    writer.close();
    console.log(`[SSE] Client disconnected from game ${code}`);
  });

  // Return the SSE response
  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}

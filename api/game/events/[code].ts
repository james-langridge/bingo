import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Extract game code from the URL
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).json({ error: "Game code is required" });
  }

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable Nginx buffering
  });

  // Track last sent data to avoid duplicate sends
  let lastGameData: string | null = null;
  let lastOnlineCount = 0;

  // Function to check and send updates
  const checkForUpdates = async () => {
    try {
      const gameData = await redis.get(`game:${code}`);

      if (!gameData) {
        res.write(`data: {"error":"Game not found"}\n\n`);
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
        res.write(`data: ${currentData}\n\n`);
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
    res.write(":heartbeat\n\n");
  }, 30000);

  // Cleanup on client disconnect
  req.on("close", () => {
    clearInterval(pollInterval);
    clearInterval(heartbeatInterval);
    console.log(`[SSE] Client disconnected from game ${code}`);
    res.end();
  });

  // Keep connection open
  // Note: Vercel has a 10 second timeout on hobby plan, 5 minutes on pro
  // The connection will auto-reconnect when it times out
}

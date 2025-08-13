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

  // Track state
  let lastGameData: string | null = null;
  let lastOnlineCount = 0;
  let pollCount = 0;
  let pollInterval = 500; // Start with 500ms
  let pollTimer: NodeJS.Timeout | null = null;
  let lastWakeupCheck = 0;

  // Function to check and send updates
  const checkForUpdates = async () => {
    try {
      pollCount++;
      const gameData = await redis.get(`game:${code}`);

      if (!gameData) {
        res.write(`data: {"error":"Game not found"}\n\n`);
        return false; // Signal to stop polling
      }

      const game =
        typeof gameData === "string" ? JSON.parse(gameData) : gameData;

      // Calculate active players
      const now = Date.now();
      const onlineCount =
        game.players?.filter((p: any) => now - (p.lastSeenAt || 0) < 15000)
          .length || 0;

      // Intelligent polling based on player count
      if (onlineCount <= 1) {
        // 0 or 1 players: Close the connection to save resources
        console.log(
          `[SSE] Game ${code}: ${onlineCount} players online - closing connection`,
        );

        // Send a final message to let client know why we're closing
        res.write(
          `data: {"status":"idle","onlineCount":${onlineCount},"message":"Waiting for more players"}\n\n`,
        );

        // Clean up and close the connection
        if (pollTimer) {
          clearTimeout(pollTimer);
        }
        clearInterval(heartbeatInterval);
        res.end();

        console.log(
          `[SSE] Game ${code}: Connection closed. Total polls: ${pollCount}`,
        );
        return false; // Signal that we've closed
      } else {
        // 2+ players: Need real-time sync
        pollInterval = 500; // Fast polling for active games

        // Send updates
        const currentData = JSON.stringify({
          ...game,
          onlineCount,
        });

        if (currentData !== lastGameData) {
          res.write(`data: ${currentData}\n\n`);
          lastGameData = currentData;

          if (onlineCount !== lastOnlineCount) {
            console.log(
              `[SSE] Game ${code}: ${onlineCount} players online - active sync`,
            );
            lastOnlineCount = onlineCount;
          }
        }

        // Continue fast polling
        pollTimer = setTimeout(() => checkForUpdates(), pollInterval);
        return true;
      }
    } catch (error) {
      console.error(`[SSE] Error checking updates for game ${code}:`, error);
      // Continue checking despite errors
      pollTimer = setTimeout(() => checkForUpdates(), 5000);
      return true;
    }
  };

  // Send initial state immediately
  checkForUpdates();

  // Send periodic heartbeats (every 30 seconds) to keep connection alive
  const heartbeatInterval = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  // Cleanup on client disconnect
  req.on("close", () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
    }
    clearInterval(heartbeatInterval);
    console.log(
      `[SSE] Client disconnected from game ${code}. Total polls: ${pollCount}`,
    );
    res.end();
  });

  // Let Vercel handle the timeout naturally - client will auto-reconnect
  // No need for manual timeout handling since EventSource handles it well
}

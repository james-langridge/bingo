import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Vercel function timeout limits
const FUNCTION_TIMEOUT = {
  HOBBY: 9000, // 9 seconds (leaving 1s buffer before 10s limit)
  PRO: 295000, // 4m 55s (leaving 5s buffer before 5min limit)
};

// Use Pro timeout if available, otherwise Hobby
const MAX_RUNTIME =
  process.env.VERCEL_ENV === "production"
    ? FUNCTION_TIMEOUT.PRO
    : FUNCTION_TIMEOUT.HOBBY;

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

  // Track timing and state
  const startTime = Date.now();
  let lastGameData: string | null = null;
  let lastOnlineCount = 0;
  let pollCount = 0;

  // Adaptive polling intervals based on activity
  let pollInterval = 500; // Start with 500ms for immediate responsiveness
  let noChangeCount = 0;

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

      // Create a version string to detect changes
      const currentData = JSON.stringify({
        ...game,
        onlineCount,
      });

      // Check if data changed
      if (currentData !== lastGameData) {
        res.write(`data: ${currentData}\n\n`);
        lastGameData = currentData;
        noChangeCount = 0; // Reset no-change counter
        pollInterval = 500; // Return to fast polling when changes detected

        // Log player count changes for debugging
        if (onlineCount !== lastOnlineCount) {
          console.log(
            `[SSE] Game ${code}: Online players changed ${lastOnlineCount} -> ${onlineCount}`,
          );
          lastOnlineCount = onlineCount;
        }
      } else {
        noChangeCount++;

        // Adaptive polling: slow down if no changes
        if (noChangeCount > 10 && pollInterval < 2000) {
          pollInterval = 1000; // After 5 seconds of no changes, slow to 1s
        } else if (noChangeCount > 30 && pollInterval < 3000) {
          pollInterval = 2000; // After 30 seconds of no changes, slow to 2s
        } else if (noChangeCount > 60) {
          pollInterval = 3000; // After 1 minute of no changes, slow to 3s max
        }
      }

      return true; // Continue polling
    } catch (error) {
      console.error(`[SSE] Error checking updates for game ${code}:`, error);
      return true; // Continue despite errors
    }
  };

  // Send initial state immediately
  const shouldContinue = await checkForUpdates();
  if (!shouldContinue) {
    res.end();
    return;
  }

  // Dynamic polling with timeout awareness
  const poll = async () => {
    const elapsed = Date.now() - startTime;
    const remaining = MAX_RUNTIME - elapsed;

    // Stop polling 2 seconds before timeout to gracefully close
    if (remaining < 2000) {
      console.log(
        `[SSE] Closing connection for game ${code} before timeout. ` +
          `Polls: ${pollCount}, Runtime: ${elapsed}ms`,
      );

      // Send a reconnect hint to the client
      res.write(`event: timeout\ndata: {"reconnect": true}\n\n`);
      res.end();
      return;
    }

    // Check for updates
    const shouldContinue = await checkForUpdates();
    if (!shouldContinue) {
      res.end();
      return;
    }

    // Schedule next poll with adaptive interval
    setTimeout(poll, pollInterval);
  };

  // Start polling after initial state
  setTimeout(poll, pollInterval);

  // Send periodic heartbeats (every 30 seconds)
  const heartbeatInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed < MAX_RUNTIME - 2000) {
      res.write(`:heartbeat\n\n`);
    }
  }, 30000);

  // Cleanup on client disconnect
  req.on("close", () => {
    clearInterval(heartbeatInterval);
    const elapsed = Date.now() - startTime;
    console.log(
      `[SSE] Client disconnected from game ${code}. ` +
        `Polls: ${pollCount}, Runtime: ${elapsed}ms, Avg interval: ${Math.round(elapsed / pollCount)}ms`,
    );
    res.end();
  });
}

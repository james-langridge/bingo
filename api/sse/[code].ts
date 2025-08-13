import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

// SSE endpoint for real-time game updates
// Clients connect and receive updates whenever the game state changes

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Invalid game code" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Send initial connection message
  res.write(`data: {"type":"connected","gameCode":"${code}"}\n\n`);

  // Polling mechanism since Vercel doesn't support true SSE with Redis pub/sub
  // We'll use a polling approach with change detection
  let lastVersion = "";

  const pollInterval = setInterval(async () => {
    try {
      const gameData = await redis.get(`game:${code}`);
      if (gameData) {
        const game =
          typeof gameData === "string" ? JSON.parse(gameData) : gameData;
        const currentVersion = JSON.stringify({
          lastModifiedAt: game.lastModifiedAt,
          playerCount: game.players?.length,
          winner: game.winner,
        });

        // Only send if there's a change
        if (currentVersion !== lastVersion) {
          lastVersion = currentVersion;
          res.write(
            `data: ${JSON.stringify({
              type: "gameUpdate",
              game: game,
              timestamp: Date.now(),
            })}\n\n`,
          );
        }
      }
    } catch (error) {
      console.error("SSE polling error:", error);
    }
  }, 1000); // Poll every second for changes

  // Clean up on client disconnect
  req.on("close", () => {
    clearInterval(pollInterval);
    res.end();
  });

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
  });
}

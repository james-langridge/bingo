import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

// Efficient polling endpoint for game state changes
// Returns only what has changed since the provided timestamp
// Note: SSE doesn't work on Vercel due to function timeout limits

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Generate a version hash from critical game fields
function generateGameVersion(game: any): string {
  const versionData = {
    lastModifiedAt: game.lastModifiedAt,
    playerCount: game.players?.length || 0,
    winner: game.winner?.displayName || null,
    items: game.items?.map((item: any) => ({
      id: item.id,
      markedByCount: item.markedBy?.length || 0,
    })),
  };
  
  return crypto
    .createHash("md5")
    .update(JSON.stringify(versionData))
    .digest("hex")
    .substring(0, 8);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code } = req.query;
  const since = parseInt(req.query.since as string) || 0;
  const version = req.query.version as string;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Invalid game code" });
  }

  try {
    const gameData = await redis.get(`game:${code}`);
    
    if (!gameData) {
      return res.status(404).json({ error: "Game not found" });
    }

    const game = typeof gameData === "string" ? JSON.parse(gameData) : gameData;
    const currentVersion = generateGameVersion(game);
    
    // If version matches, nothing has changed
    if (version && version === currentVersion) {
      return res.status(304).end();
    }
    
    // If nothing has changed since the timestamp
    if (since && game.lastModifiedAt && game.lastModifiedAt <= since) {
      return res.status(304).end();
    }

    // Prepare response with only necessary data
    const response = {
      version: currentVersion,
      lastModifiedAt: game.lastModifiedAt || Date.now(),
      changes: {
        // Only send full game if significant changes occurred
        fullUpdate: !since || since < (game.lastModifiedAt - 60000), // Full update if more than 1 minute behind
        game: !since || since < (game.lastModifiedAt - 60000) ? game : undefined,
        
        // Otherwise send incremental updates
        players: game.players,
        winner: game.winner,
        items: game.items?.map((item: any) => ({
          id: item.id,
          text: item.text,  // Include text field
          position: item.position,  // Include position
          markedBy: item.markedBy,
        })),
      },
      timestamp: Date.now(),
    };

    // Set cache headers for efficient polling
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("ETag", currentVersion);
    
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching game changes:", error);
    return res.status(500).json({ error: "Failed to fetch game changes" });
  }
}
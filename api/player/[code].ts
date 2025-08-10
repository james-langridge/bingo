import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Invalid game code" });
  }

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    try {
      const { playerId } = req.query;

      if (!playerId || typeof playerId !== "string") {
        return res.status(400).json({ error: "Player ID required" });
      }

      const playerState = await redis.get(`player:${code}:${playerId}`);
      return res.status(200).json(playerState || null);
    } catch (error) {
      console.error("Failed to load player state:", error);
      return res.status(500).json({ error: "Failed to load player state" });
    }
  }

  if (req.method === "POST") {
    try {
      const playerState = req.body;

      if (!playerState || !playerState.displayName) {
        return res.status(400).json({ error: "Invalid player state" });
      }

      // Generate a playerId if not provided
      const playerId = playerState.playerId || crypto.randomUUID();

      await redis.set(
        `player:${code}:${playerId}`,
        JSON.stringify({ ...playerState, playerId }),
        { ex: 7 * 24 * 60 * 60 }, // 7-day TTL
      );

      return res.status(200).json({ success: true, playerId });
    } catch (error) {
      console.error("Failed to save player state:", error);
      return res.status(500).json({ error: "Failed to save player state" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

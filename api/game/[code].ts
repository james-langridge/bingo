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
      const gameData = await redis.get(`game:${code}`);

      if (!gameData) {
        return res.status(404).json({ error: "Game not found" });
      }

      return res.status(200).json(gameData);
    } catch (error) {
      console.error("Failed to fetch game:", error);
      return res.status(500).json({ error: "Failed to load game" });
    }
  }

  if (req.method === "POST") {
    try {
      const game = req.body;

      // Validate game object
      if (!game || !game.gameCode || !game.id) {
        return res.status(400).json({ error: "Invalid game data" });
      }

      // Store with 30-day TTL
      await redis.set(`game:${code}`, JSON.stringify(game), {
        ex: 30 * 24 * 60 * 60,
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Failed to save game:", error);
      return res.status(500).json({ error: "Failed to save game" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

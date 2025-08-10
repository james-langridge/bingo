import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import pino from "pino";

// Initialize logger - Vercel captures these in the dashboard
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // Use pretty print in development, JSON in production
  ...(process.env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  }),
});

// Initialize Redis with environment variables
// Vercel automatically sets KV_REST_API_URL and KV_REST_API_TOKEN
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const { code } = req.query;
  
  logger.info({
    msg: "Game API request received",
    method: req.method,
    gameCode: code,
    headers: req.headers,
  });

  if (!code || typeof code !== "string") {
    logger.warn({ msg: "Invalid game code", code });
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
      logger.debug({ msg: "Fetching game from Redis", gameCode: code });
      const gameData = await redis.get(`game:${code}`);

      if (!gameData) {
        logger.info({ 
          msg: "Game not found", 
          gameCode: code,
          duration: Date.now() - startTime 
        });
        return res.status(404).json({ error: "Game not found" });
      }

      logger.info({ 
        msg: "Game fetched successfully", 
        gameCode: code,
        duration: Date.now() - startTime 
      });
      return res.status(200).json(gameData);
    } catch (error) {
      logger.error({ 
        msg: "Failed to fetch game", 
        gameCode: code,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime 
      });
      return res.status(500).json({ error: "Failed to load game" });
    }
  }

  if (req.method === "POST") {
    try {
      const game = req.body;
      
      logger.debug({ 
        msg: "Saving game to Redis", 
        gameCode: code,
        gameId: game?.id,
        itemCount: game?.items?.length 
      });

      // Validate game object
      if (!game || !game.gameCode || !game.id) {
        logger.warn({ 
          msg: "Invalid game data", 
          gameCode: code,
          hasGame: !!game,
          hasGameCode: !!game?.gameCode,
          hasId: !!game?.id 
        });
        return res.status(400).json({ error: "Invalid game data" });
      }

      // Store with 30-day TTL
      await redis.set(`game:${code}`, JSON.stringify(game), {
        ex: 30 * 24 * 60 * 60,
      });

      logger.info({ 
        msg: "Game saved successfully", 
        gameCode: code,
        gameId: game.id,
        ttl: "30 days",
        duration: Date.now() - startTime 
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ 
        msg: "Failed to save game", 
        gameCode: code,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime 
      });
      return res.status(500).json({ error: "Failed to save game" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

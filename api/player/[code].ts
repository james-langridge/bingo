import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import pino from "pino";

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  }),
});

// Check for Redis credentials
const hasRedisCredentials = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

if (!hasRedisCredentials) {
  logger.error({
    msg: "Redis credentials missing",
    hasUrl: !!process.env.KV_REST_API_URL,
    hasToken: !!process.env.KV_REST_API_TOKEN,
  });
}

// Initialize Redis with environment variables
// Vercel automatically sets KV_REST_API_URL and KV_REST_API_TOKEN
const redis = hasRedisCredentials ? new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
}) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const { code } = req.query;
  
  logger.info({
    msg: "Player API request received",
    method: req.method,
    gameCode: code,
  });

  // Check Redis connection
  if (!redis) {
    logger.error({ msg: "Redis not configured" });
    return res.status(503).json({ 
      error: "Storage service not configured",
      details: "Redis credentials are missing. Please check Vercel environment variables."
    });
  }

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
      const { playerId } = req.query;

      if (!playerId || typeof playerId !== "string") {
        logger.warn({ msg: "Player ID required", gameCode: code });
        return res.status(400).json({ error: "Player ID required" });
      }

      logger.debug({ msg: "Fetching player state", gameCode: code, playerId });
      const playerState = await redis.get(`player:${code}:${playerId}`);
      
      logger.info({ 
        msg: playerState ? "Player state found" : "Player state not found", 
        gameCode: code,
        playerId,
        duration: Date.now() - startTime 
      });
      return res.status(200).json(playerState || null);
    } catch (error) {
      logger.error({ 
        msg: "Failed to load player state", 
        gameCode: code,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime 
      });
      return res.status(500).json({ error: "Failed to load player state" });
    }
  }

  if (req.method === "POST") {
    try {
      const playerState = req.body;
      
      logger.debug({ 
        msg: "Saving player state", 
        gameCode: code,
        hasDisplayName: !!playerState?.displayName,
        hasPlayerId: !!playerState?.playerId 
      });

      if (!playerState || !playerState.displayName) {
        logger.warn({ 
          msg: "Invalid player state", 
          gameCode: code,
          hasPlayerState: !!playerState,
          hasDisplayName: !!playerState?.displayName 
        });
        return res.status(400).json({ error: "Invalid player state" });
      }

      // Generate a playerId if not provided
      const playerId = playerState.playerId || crypto.randomUUID();
      const isNewPlayer = !playerState.playerId;

      await redis.set(
        `player:${code}:${playerId}`,
        JSON.stringify({ ...playerState, playerId }),
        { ex: 7 * 24 * 60 * 60 }, // 7-day TTL
      );

      logger.info({ 
        msg: isNewPlayer ? "New player created" : "Player state updated", 
        gameCode: code,
        playerId,
        displayName: playerState.displayName,
        ttl: "7 days",
        duration: Date.now() - startTime 
      });
      return res.status(200).json({ success: true, playerId });
    } catch (error) {
      logger.error({ 
        msg: "Failed to save player state", 
        gameCode: code,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime 
      });
      return res.status(500).json({ error: "Failed to save player state" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

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

// Check for Redis credentials
const hasRedisCredentials =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

if (!hasRedisCredentials) {
  logger.error({
    msg: "Redis credentials missing",
    hasUrl: !!process.env.KV_REST_API_URL,
    hasToken: !!process.env.KV_REST_API_TOKEN,
  });
}

// Initialize Redis with environment variables
// Vercel automatically sets KV_REST_API_URL and KV_REST_API_TOKEN
const redis = hasRedisCredentials
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const { code } = req.query;

  logger.info({
    msg: "Game API request received",
    method: req.method,
    gameCode: code,
    headers: req.headers,
  });

  // Check Redis connection
  if (!redis) {
    logger.error({ msg: "Redis not configured" });
    return res.status(503).json({
      error: "Storage service not configured",
      details:
        "Redis credentials are missing. Please check Vercel environment variables.",
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
      logger.debug({ msg: "Fetching game from Redis", gameCode: code });
      const gameData = await redis.get(`game:${code}`);

      if (!gameData) {
        logger.info({
          msg: "Game not found",
          gameCode: code,
          duration: Date.now() - startTime,
        });
        return res.status(404).json({ error: "Game not found" });
      }

      // Parse the JSON string from Redis before sending
      const game =
        typeof gameData === "string" ? JSON.parse(gameData) : gameData;

      logger.info({
        msg: "Game fetched successfully",
        gameCode: code,
        hasWinner: !!game.winner,
        playerCount: game.players?.length || 0,
        duration: Date.now() - startTime,
      });
      return res.status(200).json(game);
    } catch (error) {
      logger.error({
        msg: "Failed to fetch game",
        gameCode: code,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
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
        itemCount: game?.items?.length,
        hasWinner: !!game?.winner,
        winnerName: game?.winner?.displayName,
        playerCount: game?.players?.length,
      });

      // Validate game object
      if (!game || !game.gameCode || !game.id) {
        logger.warn({
          msg: "Invalid game data",
          gameCode: code,
          hasGame: !!game,
          hasGameCode: !!game?.gameCode,
          hasId: !!game?.id,
        });
        return res.status(400).json({ error: "Invalid game data" });
      }

      // Get existing game for conflict resolution
      const existingData = await redis.get(`game:${code}`);
      // Ensure game has settings
      let finalGame = {
        ...game,
        settings: game.settings || {
          gridSize: 5,
          requireFullCard: false,
          freeSpace: true,
        },
      };

      if (existingData) {
        const existing =
          typeof existingData === "string"
            ? JSON.parse(existingData)
            : existingData;

        // Conflict resolution: merge player lists and preserve winner
        if (existing.lastModifiedAt && game.lastModifiedAt) {
          // Create a merged player list
          const playerMap = new Map();

          // Add all existing players
          existing.players?.forEach((player: any) => {
            playerMap.set(player.displayName, player);
          });

          // Merge in new players or update existing ones
          game.players?.forEach((player: any) => {
            const existingPlayer = playerMap.get(player.displayName);
            if (
              !existingPlayer ||
              player.lastSeenAt > existingPlayer.lastSeenAt
            ) {
              playerMap.set(player.displayName, player);
            }
          });

          finalGame = {
            ...game,
            players: Array.from(playerMap.values()),
            // Preserve winner if it exists
            winner: existing.winner || game.winner,
            // Preserve settings if missing in new game
            settings: game.settings ||
              existing.settings || {
                gridSize: 5,
                requireFullCard: false,
                freeSpace: true,
              },
            // Use the latest modification timestamp
            lastModifiedAt: Math.max(
              existing.lastModifiedAt,
              game.lastModifiedAt,
            ),
          };

          logger.info({
            msg: "Merged game state",
            gameCode: code,
            existingPlayers: existing.players?.length,
            newPlayers: game.players?.length,
            mergedPlayers: finalGame.players?.length,
          });
        }
      }

      // Store with 30-day TTL
      await redis.set(`game:${code}`, JSON.stringify(finalGame), {
        ex: 30 * 24 * 60 * 60,
      });

      logger.info({
        msg: "Game saved successfully",
        gameCode: code,
        gameId: finalGame.id,
        playerCount: finalGame.players?.length,
        ttl: "30 days",
        duration: Date.now() - startTime,
      });
      return res.status(200).json({ success: true, game: finalGame });
    } catch (error) {
      logger.error({
        msg: "Failed to save game",
        gameCode: code,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });
      return res.status(500).json({ error: "Failed to save game" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

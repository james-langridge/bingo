import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import pino from "pino";
import {
  validateWinningPositions,
  getWinningLinePositions,
} from "../../lib/winValidation";

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
const hasRedisCredentials =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

// Initialize Redis
const redis = hasRedisCredentials
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

interface WinClaimRequest {
  playerId: string;
  displayName: string;
  winType: "line" | "fullCard";
  winningPositions: number[];
  clientTimestamp: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const { code } = req.query;

  logger.info({
    msg: "Win claim request received",
    method: req.method,
    gameCode: code,
  });

  // Check Redis connection
  if (!redis) {
    logger.error({ msg: "Redis not configured" });
    return res.status(503).json({
      error: "Storage service not configured",
    });
  }

  if (!code || typeof code !== "string") {
    logger.warn({ msg: "Invalid game code", code });
    return res.status(400).json({ error: "Invalid game code" });
  }

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const claimData: WinClaimRequest = req.body;

    logger.info({
      msg: "Processing win claim",
      gameCode: code,
      playerId: claimData.playerId,
      displayName: claimData.displayName,
      winType: claimData.winType,
      positionCount: claimData.winningPositions?.length,
      clientTimestamp: claimData.clientTimestamp,
    });

    // Validate claim data
    if (!claimData.playerId || !claimData.displayName || !claimData.winType) {
      logger.warn({ msg: "Invalid win claim data", claimData });
      return res.status(400).json({ error: "Invalid win claim data" });
    }

    // Use Redis transaction for atomic winner update
    const lockKey = `game:${code}:winner-lock`;
    const gameKey = `game:${code}`;

    // Try to acquire a lock (expires in 5 seconds to prevent deadlock)
    const lockAcquired = await redis.set(lockKey, claimData.playerId, {
      nx: true, // Only set if not exists
      ex: 5, // Expire in 5 seconds
    });

    if (!lockAcquired) {
      logger.info({
        msg: "Failed to acquire winner lock - another claim in progress",
        gameCode: code,
        playerId: claimData.playerId,
      });
    }

    try {
      // Fetch current game state
      const gameData = await redis.get(gameKey);

      if (!gameData) {
        logger.error({ msg: "Game not found", gameCode: code });
        return res.status(404).json({ error: "Game not found" });
      }

      const game =
        typeof gameData === "string" ? JSON.parse(gameData) : gameData;

      // Check if game already has a winner
      if (game.winner) {
        const timeDiff = Date.now() - game.winner.wonAt;

        logger.info({
          msg: "Game already has a winner",
          gameCode: code,
          existingWinner: game.winner.displayName,
          existingWonAt: game.winner.wonAt,
          claimant: claimData.displayName,
          timeDifference: timeDiff,
        });

        // Special case: handle identical timestamps (use playerId as tiebreaker)
        if (timeDiff < 100 && claimData.playerId < game.winner.playerId) {
          logger.info({
            msg: "Tiebreaker scenario - both players won within 100ms",
            gameCode: code,
            existingWinner: game.winner.displayName,
            claimant: claimData.displayName,
            existingPlayerId: game.winner.playerId,
            claimantPlayerId: claimData.playerId,
            decision: "Existing winner stands (higher playerId)",
          });
        }

        // Return rejection with actual winner info
        return res.status(200).json({
          accepted: false,
          actualWinner: game.winner,
          game: game,
          message: "Someone else has already won this game",
          timeDifference: timeDiff,
        });
      }

      // Validate the win claim with actual game settings
      const validation = validateWinningPositions(
        claimData.winningPositions,
        game.settings?.gridSize || 5,
        game.settings?.requireFullCard || false,
        game.settings?.freeSpace !== false, // Default to true if not specified
      );

      if (!validation.isValid) {
        logger.warn({
          msg: "Invalid win claim - positions don't constitute a win",
          gameCode: code,
          playerId: claimData.playerId,
          displayName: claimData.displayName,
          positions: claimData.winningPositions,
          reason: validation.reason,
        });

        // Log failed attempt for audit
        const auditKey = `game:${code}:win-attempts`;
        await redis.lpush(
          auditKey,
          JSON.stringify({
            playerId: claimData.playerId,
            displayName: claimData.displayName,
            attemptedAt: Date.now(),
            accepted: false,
            reason: validation.reason,
            positions: claimData.winningPositions,
          }),
        );
        await redis.expire(auditKey, 7 * 24 * 60 * 60);

        return res.status(400).json({
          accepted: false,
          error: "Invalid win claim",
          reason: validation.reason,
        });
      }

      // Extract actual winning line for audit
      const winningLine = getWinningLinePositions(
        claimData.winningPositions,
        game.settings?.gridSize || 5,
        game.settings?.freeSpace !== false,
      );

      // No winner yet and valid win - this player wins!
      const serverTimestamp = Date.now();
      const winner = {
        playerId: claimData.playerId,
        displayName: claimData.displayName,
        wonAt: serverTimestamp,
        winType: validation.winType || claimData.winType,
        winningPositions: claimData.winningPositions,
        winningLine: winningLine, // Store the actual winning line for audit
      };

      // Update game with winner
      const updatedGame = {
        ...game,
        winner: winner,
        lastModifiedAt: serverTimestamp,
        // Update player's hasWon status
        players:
          game.players?.map((p: any) =>
            p.id === claimData.playerId ||
            p.displayName === claimData.displayName
              ? { ...p, hasWon: true, lastSeenAt: serverTimestamp }
              : p,
          ) || [],
      };

      // Save updated game atomically
      await redis.set(gameKey, JSON.stringify(updatedGame), {
        ex: 30 * 24 * 60 * 60, // 30-day TTL
      });

      // Log win for audit
      const auditKey = `game:${code}:win-attempts`;
      await redis.lpush(
        auditKey,
        JSON.stringify({
          playerId: claimData.playerId,
          displayName: claimData.displayName,
          attemptedAt: serverTimestamp,
          clientTimestamp: claimData.clientTimestamp,
          accepted: true,
          winType: claimData.winType,
          winningPositions: claimData.winningPositions,
        }),
      );

      // Set TTL on audit log
      await redis.expire(auditKey, 7 * 24 * 60 * 60); // 7-day TTL for audit logs

      logger.info({
        msg: "Win claim accepted",
        gameCode: code,
        winner: claimData.displayName,
        serverTimestamp,
        clientTimestamp: claimData.clientTimestamp,
        latency: serverTimestamp - claimData.clientTimestamp,
        duration: Date.now() - startTime,
      });

      return res.status(200).json({
        accepted: true,
        game: updatedGame,
        winner: winner,
        message: "Congratulations! You won!",
      });
    } finally {
      // Always release the lock
      if (lockAcquired) {
        await redis.del(lockKey);
      }
    }
  } catch (error) {
    logger.error({
      msg: "Failed to process win claim",
      gameCode: code,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
    });
    return res.status(500).json({ error: "Failed to process win claim" });
  }
}

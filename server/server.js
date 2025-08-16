import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { Redis } from "@upstash/redis";
import IORedis from "ioredis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

// Initialize Fastify with logging
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

// Serve static files (the built React app) but don't take over all GET routes
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, "../dist"),
  prefix: "/",
  wildcard: false, // prevents auto /* registration
});

// Upstash Redis for data storage
const upstash = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Redis for Pub/Sub (using Redis connection string)
// For Railway/Fly, you'd use their Redis add-on
const pubClient = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
);
const subClient = pubClient.duplicate();

// Track active SSE connections per game
const gameConnections = new Map(); // gameCode -> Set of response objects

// Subscribe to Redis pub/sub channels
subClient.on("message", async (channel, message) => {
  if (channel.startsWith("game:")) {
    const gameCode = channel.split(":")[1];
    const connections = gameConnections.get(gameCode);

    if (connections && connections.size > 0) {
      // Parse the message to get the event type
      const event = JSON.parse(message);

      // Fetch the latest game state from Upstash
      const gameData = await upstash.get(`game:${gameCode}`);
      if (gameData) {
        const game =
          typeof gameData === "string" ? JSON.parse(gameData) : gameData;

        // Calculate online count
        const now = Date.now();
        const onlineCount =
          game.players?.filter((p) => now - (p.lastSeenAt || 0) < 15000)
            .length || 0;

        // Send to all connected clients
        const data = JSON.stringify({
          ...game,
          onlineCount,
          event: event.type,
        });
        connections.forEach((res) => {
          res.raw.write(`data: ${data}\n\n`);
        });

        fastify.log.info(
          `Broadcasted ${event.type} to ${connections.size} clients in game ${gameCode}`,
        );
      }
    }
  }
});

// Health check endpoint
fastify.get("/health", async (request, reply) => {
  return { status: "healthy", connections: gameConnections.size };
});

// SSE endpoint for game updates
fastify.get("/api/game/events/:code", async (request, reply) => {
  const { code } = request.params;

  fastify.log.info(`SSE connection requested for game ${code}`);

  // Set SSE headers
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Subscribe to this game's channel
  await subClient.subscribe(`game:${code}`);

  // Add this connection to the game's connection set
  if (!gameConnections.has(code)) {
    gameConnections.set(code, new Set());
  }
  gameConnections.get(code).add(reply);

  // Send initial game state
  const gameData = await upstash.get(`game:${code}`);
  if (gameData) {
    const game = typeof gameData === "string" ? JSON.parse(gameData) : gameData;
    const now = Date.now();
    const onlineCount =
      game.players?.filter((p) => now - (p.lastSeenAt || 0) < 15000).length ||
      0;

    reply.raw.write(`data: ${JSON.stringify({ ...game, onlineCount })}\n\n`);
  } else {
    reply.raw.write(`data: {"error":"Game not found"}\n\n`);
  }

  // Send periodic heartbeats to keep connection alive
  const heartbeatInterval = setInterval(() => {
    reply.raw.write(":heartbeat\n\n");
  }, 30000);

  // Clean up on disconnect
  request.raw.on("close", () => {
    const connections = gameConnections.get(code);
    if (connections) {
      connections.delete(reply);
      if (connections.size === 0) {
        gameConnections.delete(code);
        subClient.unsubscribe(`game:${code}`);
        fastify.log.info(`No more connections for game ${code}, unsubscribed`);
      }
    }
    clearInterval(heartbeatInterval);
    fastify.log.info(`SSE connection closed for game ${code}`);
  });
});

// Game state update endpoint
fastify.post("/api/game/:code", async (request, reply) => {
  const { code } = request.params;
  const game = request.body;

  try {
    // Get existing game for comparison
    const existingData = await upstash.get(`game:${code}`);
    const existingGame = existingData
      ? typeof existingData === "string"
        ? JSON.parse(existingData)
        : existingData
      : null;

    // Save to Upstash
    await upstash.set(`game:${code}`, JSON.stringify(game), {
      ex: 30 * 24 * 60 * 60, // 30 days TTL
    });

    // Determine what changed and publish event
    let eventType = "update";
    if (existingGame) {
      const oldPlayerCount = existingGame.players?.length || 0;
      const newPlayerCount = game.players?.length || 0;

      if (newPlayerCount > oldPlayerCount) {
        eventType = "player-joined";
      } else if (game.winner && !existingGame.winner) {
        eventType = "game-won";
      } else if (game.items?.length !== existingGame.items?.length) {
        eventType = "items-changed";
      }
    }

    // Publish to Redis pub/sub - this triggers SSE updates
    await pubClient.publish(
      `game:${code}`,
      JSON.stringify({
        type: eventType,
        timestamp: Date.now(),
      }),
    );

    fastify.log.info(`Game ${code} updated, event: ${eventType}`);
    return { success: true };
  } catch (error) {
    fastify.log.error(error);
    reply.code(500);
    return { error: "Failed to save game" };
  }
});

// Player state endpoints
fastify.get("/api/player/:code", async (request, reply) => {
  const { code } = request.params;
  const { playerId } = request.query;

  if (!playerId) {
    reply.code(400);
    return { error: "Player ID required" };
  }

  try {
    const playerData = await upstash.get(`player:${code}:${playerId}`);
    if (!playerData) {
      return null; // Player doesn't exist yet
    }

    const player =
      typeof playerData === "string" ? JSON.parse(playerData) : playerData;
    return player;
  } catch (error) {
    fastify.log.error(error);
    reply.code(500);
    return { error: "Failed to load player state" };
  }
});

fastify.post("/api/player/:code", async (request, reply) => {
  const { code } = request.params;
  const playerState = request.body;

  if (!playerState || !playerState.displayName) {
    reply.code(400);
    return { error: "Invalid player state" };
  }

  try {
    const playerId = playerState.playerId || crypto.randomUUID();

    await upstash.set(
      `player:${code}:${playerId}`,
      JSON.stringify({ ...playerState, playerId }),
      { ex: 7 * 24 * 60 * 60 }, // 7-day TTL
    );

    return { success: true, playerId };
  } catch (error) {
    fastify.log.error(error);
    reply.code(500);
    return { error: "Failed to save player state" };
  }
});

// Player heartbeat endpoint
fastify.post("/api/player/:code/heartbeat", async (request, reply) => {
  const { code } = request.params;
  const { playerId } = request.body;

  try {
    const gameData = await upstash.get(`game:${code}`);
    if (!gameData) {
      reply.code(404);
      return { error: "Game not found" };
    }

    const game = typeof gameData === "string" ? JSON.parse(gameData) : gameData;

    // Update player's lastSeenAt
    const updatedPlayers =
      game.players?.map((p) =>
        p.id === playerId ? { ...p, lastSeenAt: Date.now() } : p,
      ) || [];

    const updatedGame = { ...game, players: updatedPlayers };

    // Save and broadcast
    await upstash.set(`game:${code}`, JSON.stringify(updatedGame), {
      ex: 7 * 24 * 60 * 60,
    });

    await pubClient.publish(
      `game:${code}`,
      JSON.stringify({
        type: "heartbeat",
        playerId,
        timestamp: Date.now(),
      }),
    );

    return { success: true };
  } catch (error) {
    fastify.log.error(error);
    reply.code(500);
    return { error: "Failed to update heartbeat" };
  }
});

// Get game state
fastify.get("/api/game/:code", async (request, reply) => {
  const { code } = request.params;

  try {
    const gameData = await upstash.get(`game:${code}`);
    if (!gameData) {
      reply.code(404);
      return { error: "Game not found" };
    }

    const game = typeof gameData === "string" ? JSON.parse(gameData) : gameData;
    return game;
  } catch (error) {
    fastify.log.error(error);
    reply.code(500);
    return { error: "Failed to load game" };
  }
});

// Get leaderboard data
fastify.get("/api/game/:code/leaderboard", async (request, reply) => {
  const { code } = request.params;

  try {
    const gameData = await upstash.get(`game:${code}`);
    if (!gameData) {
      reply.code(404);
      return { error: "Game not found" };
    }

    const game = typeof gameData === "string" ? JSON.parse(gameData) : gameData;

    // Build leaderboard data for all players in the game
    const playersWithCounts = [];

    // Instead of using keys command, iterate through known players
    if (game.players && game.players.length > 0) {
      for (const player of game.players) {
        // Try to fetch player state by constructing the key
        let playerState = null;
        let total = 0;
        const textCounts = {};

        // Try to get player state using their ID
        if (player.id) {
          const playerStateData = await upstash.get(
            `player:${code}:${player.id}`,
          );
          if (playerStateData) {
            playerState =
              typeof playerStateData === "string"
                ? JSON.parse(playerStateData)
                : playerStateData;
          }
        }

        // If we found player state, extract their counts
        if (playerState && playerState.itemCounts) {
          Object.entries(playerState.itemCounts).forEach(
            ([position, count]) => {
              const item = game.items.find(
                (i) => i.position === parseInt(position),
              );
              if (item) {
                textCounts[item.text] = count;
                total += count;
              }
            },
          );
        }

        playersWithCounts.push({
          ...player,
          itemCounts: textCounts,
          total,
        });
      }
    }

    return {
      players: playersWithCounts.sort((a, b) => b.total - a.total),
    };
  } catch (error) {
    fastify.log.error(error);
    reply.code(500);
    return { error: "Failed to load leaderboard" };
  }
});

// Claim win endpoint
fastify.post("/api/game/:code/claim-win", async (request, reply) => {
  const { code } = request.params;
  const { playerId, markedPositions } = request.body;

  try {
    const gameData = await upstash.get(`game:${code}`);
    if (!gameData) {
      reply.code(404);
      return { error: "Game not found" };
    }

    const game = typeof gameData === "string" ? JSON.parse(gameData) : gameData;

    // Check if game already has a winner
    if (game.winner) {
      return { success: false, message: "Game already has a winner" };
    }

    // Verify the win (all items marked)
    if (markedPositions.length !== game.items.length) {
      return { success: false, message: "Not all items marked" };
    }

    // Find the player
    const player = game.players.find((p) => p.id === playerId);
    if (!player) {
      return { success: false, message: "Player not found" };
    }

    // Set the winner
    game.winner = {
      playerId,
      displayName: player.displayName,
      wonAt: Date.now(),
      winType: "fullCard",
      winningPositions: markedPositions,
    };

    // Update player's won status
    game.players = game.players.map((p) =>
      p.id === playerId ? { ...p, hasWon: true, lastSeenAt: Date.now() } : p,
    );

    // Save the updated game
    await upstash.set(`game:${code}`, JSON.stringify(game), {
      ex: 30 * 24 * 60 * 60,
    });

    // Broadcast the win event
    await pubClient.publish(
      `game:${code}`,
      JSON.stringify({
        type: "game-won",
        winner: game.winner,
        timestamp: Date.now(),
      }),
    );

    fastify.log.info(`Player ${player.displayName} won game ${code}`);
    return { success: true, winner: game.winner };
  } catch (error) {
    fastify.log.error(error);
    reply.code(500);
    return { error: "Failed to claim win" };
  }
});

// SPA fallback — sends index.html for all non-API GET requests
fastify.setNotFoundHandler((req, reply) => {
  if (req.raw.method === "GET" && !req.raw.url.startsWith("/api")) {
    reply.type("text/html").sendFile("index.html");
  } else {
    reply.code(404).send({ error: "Not Found" });
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`Server listening on ${HOST}:${PORT}`);
  fastify.log.info(`Active game connections: ${gameConnections.size}`);
  fastify.log.info(`Serving frontend from ${path.join(__dirname, "../dist")}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

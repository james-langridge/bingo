import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code } = req.query;
  const { playerId } = req.body;

  if (!code || !playerId) {
    return res.status(400).json({ error: "Game code and player ID required" });
  }

  try {
    // Get the current game state
    const gameData = await redis.get(`game:${code}`);

    if (!gameData) {
      return res.status(404).json({ error: "Game not found" });
    }

    const game = typeof gameData === "string" ? JSON.parse(gameData) : gameData;

    // Update the player's lastSeenAt
    const updatedPlayers =
      game.players?.map((p: any) =>
        p.id === playerId ? { ...p, lastSeenAt: Date.now() } : p,
      ) || [];

    // Save the updated game
    const updatedGame = {
      ...game,
      players: updatedPlayers,
    };

    await redis.set(`game:${code}`, JSON.stringify(updatedGame), {
      ex: 7 * 24 * 60 * 60, // 7 days TTL
    });

    console.log(
      `[Heartbeat] Player ${playerId} in game ${code} marked as online`,
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[Heartbeat] Error updating player activity:`, error);
    return res.status(500).json({ error: "Failed to update activity" });
  }
}

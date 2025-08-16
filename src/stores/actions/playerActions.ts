import type { Game, PlayerState } from "../../types/types";
import {
  saveGameLocal,
  savePlayerState,
  loadPlayerState,
  loadGameByCode,
} from "../../lib/storage";
import { upsertPlayer } from "../calculations/gameCalculations";
import { PlayerStateSchema } from "../../schemas/gameSchemas";
import { safeValidate, sanitizeString } from "../../schemas/validation";

/**
 * Join a game as a player
 */
export async function joinGame(
  gameCode: string,
  displayName: string,
): Promise<{ game: Game; playerState: PlayerState; playerId: string }> {
  const sanitizedName = sanitizeString(displayName, 50);
  if (!sanitizedName) {
    throw new Error("Display name is required");
  }

  const game = await loadGameByCode(gameCode);
  if (!game) throw new Error("Game not found");

  const playerId = crypto.randomUUID();
  const updatedGame = upsertPlayer(game, playerId, sanitizedName);

  // Store playerId for future syncs
  localStorage.setItem(`playerId-${gameCode}`, playerId);

  await saveGameLocal(updatedGame);

  if (navigator.onLine) {
    try {
      await fetch(`/api/game/${gameCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedGame),
      });
    } catch (error) {}
  }

  let playerState = await loadPlayerState(gameCode);
  if (!playerState || playerState.displayName !== sanitizedName) {
    playerState = {
      gameCode,
      displayName: sanitizedName,
      itemCounts: {},
      lastSyncAt: Date.now(),
    };

    const validation = safeValidate(PlayerStateSchema, playerState);
    if (!validation.success) {
      throw new Error(`Invalid player state: ${validation.error}`);
    }

    await savePlayerState(playerState);
  }

  return { game: updatedGame, playerState, playerId };
}

/**
 * Save player state to storage
 */
export async function persistPlayerState(state: PlayerState): Promise<void> {
  await savePlayerState(state);
}

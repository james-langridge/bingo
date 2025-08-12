import type { Game, PlayerState } from "../../types/types";
import {
  saveGameLocal,
  savePlayerState,
  loadPlayerState,
  loadGameByCode,
} from "../../lib/storage";
import { upsertPlayer, updatePlayerActivity as updateActivity } from "../calculations/gameCalculations";
import { getSyncManager } from "../../lib/syncManager";

/**
 * Join a game as a player
 */
export async function joinGame(
  gameCode: string,
  displayName: string
): Promise<{ game: Game; playerState: PlayerState; playerId: string }> {
  const game = await loadGameByCode(gameCode);
  if (!game) throw new Error("Game not found");

  const playerId = crypto.randomUUID();
  const updatedGame = upsertPlayer(game, playerId, displayName);
  
  await saveGameLocal(updatedGame);

  if (navigator.onLine) {
    try {
      await fetch(`/api/game/${gameCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedGame),
      });
    } catch (error) {
    }
  }

  let playerState = await loadPlayerState(gameCode);
  if (!playerState || playerState.displayName !== displayName) {
    const existingPlayer = updatedGame.players.find(p => p.displayName === displayName);
    playerState = {
      gameCode,
      displayName,
      markedPositions: [],
      lastSyncAt: Date.now(),
      hasWon: existingPlayer?.hasWon || false,
    };
    await savePlayerState(playerState);
  }

  return { game: updatedGame, playerState, playerId };
}

/**
 * Update player activity
 */
export async function updatePlayerActivity(
  game: Game,
  playerId: string
): Promise<Game> {
  const syncManager = getSyncManager();
  if (syncManager) {
    syncManager.markActivity(false);
  }

  const updatedGame = updateActivity(game, playerId);
  await saveGameLocal(updatedGame);
  return updatedGame;
}

/**
 * Save player state to storage
 */
export async function persistPlayerState(state: PlayerState): Promise<void> {
  await savePlayerState(state);
}
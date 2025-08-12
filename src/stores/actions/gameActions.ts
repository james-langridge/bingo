import type { Game } from "../../types/types";
import {
  saveGameLocal,
  loadLocalGames,
  loadGameByCode,
  deleteGameLocal,
} from "../../lib/storage";
import { createNewGame, updateGameItems } from "../calculations/gameCalculations";

/**
 * Create a new game and save it
 */
export async function createGame(title: string): Promise<Game> {
  const game = createNewGame(title);
  await saveGameLocal(game);
  return game;
}

/**
 * Load a game by its code
 */
export async function loadGame(gameCode: string): Promise<Game | undefined> {
  return await loadGameByCode(gameCode);
}

/**
 * Update game items and save
 */
export async function saveGameItems(game: Game, items: any[]): Promise<Game> {
  const updatedGame = updateGameItems(game, items);
  await saveGameLocal(updatedGame);
  
  if (navigator.onLine && game.adminToken) {
    try {
      await fetch(`/api/game/${game.gameCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedGame),
      });
    } catch (error) {
    }
  }
  
  return updatedGame;
}

/**
 * Delete a game locally
 */
export async function deleteGame(gameId: string): Promise<void> {
  await deleteGameLocal(gameId);
}

/**
 * Initialize and load all local games
 */
export async function initializeGames(): Promise<Game[]> {
  return await loadLocalGames();
}
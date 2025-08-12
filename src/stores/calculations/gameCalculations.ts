import type { Game, Player, BingoItem } from "../../types/types";
import { generateGameCode, generateAdminToken } from "../../lib/calculations";

/**
 * Create a new game with default settings
 */
export function createNewGame(title: string): Game {
  return {
    id: crypto.randomUUID(),
    adminToken: generateAdminToken(),
    gameCode: generateGameCode(),
    title,
    items: [],
    settings: { gridSize: 5, requireFullCard: false, freeSpace: true },
    createdAt: Date.now(),
    lastModifiedAt: Date.now(),
    players: [],
  };
}

/**
 * Update game items and timestamp
 */
export function updateGameItems(game: Game, items: BingoItem[]): Game {
  return {
    ...game,
    items,
    lastModifiedAt: Date.now(),
  };
}

/**
 * Add or update a player in the game
 */
export function upsertPlayer(game: Game, playerId: string, displayName: string): Game {
  const existingPlayerIndex = game.players.findIndex(
    (p) => p.displayName === displayName
  );

  let updatedPlayers = [...game.players];
  
  if (existingPlayerIndex >= 0) {
    updatedPlayers[existingPlayerIndex] = {
      ...updatedPlayers[existingPlayerIndex],
      id: playerId,
      lastSeenAt: Date.now(),
      isOnline: true,
    };
  } else {
    const newPlayer: Player = {
      id: playerId,
      displayName,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
      hasWon: false,
      isOnline: true,
    };
    updatedPlayers.push(newPlayer);
  }

  return {
    ...game,
    players: updatedPlayers,
    lastModifiedAt: Date.now(),
  };
}

/**
 * Update player activity timestamp
 */
export function updatePlayerActivity(game: Game, playerId: string): Game {
  const playerExists = game.players.some(p => p.id === playerId);
  if (!playerExists) {
    return game;
  }

  const updatedPlayers = game.players.map((p) =>
    p.id === playerId
      ? { ...p, lastSeenAt: Date.now(), isOnline: true }
      : p
  );

  return {
    ...game,
    players: updatedPlayers,
    lastModifiedAt: Date.now(),
  };
}

/**
 * Mark a player as winner
 */
export function markPlayerAsWinner(game: Game, playerId: string): Game {
  return {
    ...game,
    players: game.players.map((p) =>
      p.id === playerId
        ? { ...p, hasWon: true, lastSeenAt: Date.now() }
        : p
    ),
    lastModifiedAt: Date.now(),
  };
}
import Dexie, { type Table } from "dexie";
import type { Game, PlayerState, GameEvent } from "../types/types.ts";

class BingoDB extends Dexie {
  games!: Table<Game>;
  playerStates!: Table<PlayerState>;
  pendingEvents!: Table<GameEvent & { id?: number }>;

  constructor() {
    super("BingoDB");
    this.version(1).stores({
      games: "id, gameCode, adminToken",
      playerStates: "gameCode",
      pendingEvents: "++id, timestamp",
    });
  }
}

export const db = new BingoDB();

// Backend sync functions
async function syncGameToServer(game: Game): Promise<boolean> {
  try {
    const response = await fetch(`/api/game/${game.gameCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(game),
    });
    return response.ok;
  } catch (error) {
    console.warn("Failed to sync game to server:", error);
    return false;
  }
}

async function fetchGameFromServer(gameCode: string): Promise<Game | null> {
  try {
    const response = await fetch(`/api/game/${gameCode}`);
    if (response.ok) {
      const data = await response.json();
      // Handle both direct game object and stringified JSON
      return typeof data === "string" ? JSON.parse(data) : data;
    }
  } catch (error) {
    console.warn("Failed to fetch game from server:", error);
  }
  return null;
}

async function syncPlayerStateToServer(state: PlayerState): Promise<boolean> {
  try {
    const response = await fetch(`/api/player/${state.gameCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    return response.ok;
  } catch (error) {
    console.warn("Failed to sync player state to server:", error);
    return false;
  }
}

// Pure functions for data operations
export async function saveGameLocal(game: Game): Promise<void> {
  // Save to IndexedDB first (immediate feedback)
  await db.games.put(game);

  // Sync to server in background
  syncGameToServer(game).then((success) => {
    if (!success && navigator.onLine) {
      // Queue for retry if online but failed
      queueEvent({
        type: "GAME_RESET",
        timestamp: Date.now(),
      } as GameEvent);
    }
  });
}

export async function loadLocalGames(): Promise<Game[]> {
  return await db.games.toArray();
}

export async function loadGameByCode(
  gameCode: string,
): Promise<Game | undefined> {
  // Try local first (instant response)
  let game = await db.games.where("gameCode").equals(gameCode).first();

  if (!game && navigator.onLine) {
    // Not found locally, try server
    const serverGame = await fetchGameFromServer(gameCode);
    if (serverGame) {
      // Cache locally for offline play
      await db.games.put(serverGame);
      game = serverGame;
    }
  }

  return game;
}

export async function loadGameByAdminToken(
  adminToken: string,
): Promise<Game | undefined> {
  return await db.games.where("adminToken").equals(adminToken).first();
}

export async function deleteGameLocal(gameId: string): Promise<void> {
  await db.games.delete(gameId);
}

export async function savePlayerState(playerState: PlayerState): Promise<void> {
  // Save locally first
  await db.playerStates.put(playerState);

  // Sync to server in background
  syncPlayerStateToServer(playerState).then((success) => {
    if (!success && navigator.onLine) {
      // Queue for retry if online but failed
      queueEvent({
        type: "GAME_RESET",
        timestamp: Date.now(),
      } as GameEvent);
    }
  });
}

export async function loadPlayerState(
  gameCode: string,
): Promise<PlayerState | undefined> {
  return await db.playerStates.get(gameCode);
}

export async function queueEvent(event: GameEvent): Promise<void> {
  await db.pendingEvents.add(event);
}

export async function processPendingEvents(): Promise<void> {
  if (!navigator.onLine) return;

  const events = await db.pendingEvents.toArray();
  for (const event of events) {
    try {
      // For now, just clear the events as we sync games directly
      // In the future, we can implement event-based sync here
      await db.pendingEvents.delete(event.id!);
    } catch {
      // Keep in queue for retry
      break;
    }
  }

  // Also sync any unsaved games
  const games = await db.games.toArray();
  for (const game of games) {
    await syncGameToServer(game);
  }
}

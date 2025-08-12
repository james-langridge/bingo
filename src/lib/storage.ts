import Dexie, { type Table } from "dexie";
import type { Game, PlayerState, GameEvent } from "../types/types.ts";
import { STORAGE, TIMEOUTS } from "./constants";

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

// Sync throttling to prevent overwhelming the server
const syncThrottle = new Map<string, number>();

// Backend sync functions with throttling and retry logic
async function syncGameToServer(game: Game): Promise<boolean> {
  
  // Check throttle
  const lastSync = syncThrottle.get(game.gameCode) || 0;
  const timeSinceLastSync = Date.now() - lastSync;
  if (timeSinceLastSync < STORAGE.SYNC_THROTTLE_MS) {
    return false;
  }
  
  try {
    const response = await fetch(`/api/game/${game.gameCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(game),
    });

    if (response.ok) {
      syncThrottle.set(game.gameCode, Date.now());
    }
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function fetchGameFromServer(gameCode: string): Promise<Game | null> {
  try {
    const response = await fetch(`/api/game/${gameCode}`);

    if (response.ok) {
      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const game = await response.json();

        // Validate we got a proper game object
        if (!game || typeof game !== "object") {
          return null;
        }

        return game;
      } else {
        // Non-JSON response (likely HTML error page)
        await response.text();
        return null;
      }
    }
  } catch (error) {
    // Error handled silently
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
    return false;
  }
}

// Pure functions for data operations
export async function saveGameLocal(game: Game): Promise<void> {
  // Validate game object before saving
  if (!game || !game.id || !game.gameCode) {
    return;
  }

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

  // Get local version first as fallback
  let localGame = await db.games.where("gameCode").equals(gameCode).first();

  if (navigator.onLine) {
    // When online, always try to get the latest from server
    const serverGame = await fetchGameFromServer(gameCode);
    if (serverGame) {
      // Intelligent merge: preserve local admin token and merge player lists
      let mergedGame = serverGame;
      
      if (localGame) {
        // Preserve admin token if we have it locally
        if (localGame.adminToken) {
          mergedGame = { ...serverGame, adminToken: localGame.adminToken };
        }
        
        // Merge player lists to avoid losing players
        const playerMap = new Map<string, any>();
        
        // Add all server players first (source of truth)
        serverGame.players?.forEach(player => {
          playerMap.set(player.displayName, player);
        });
        
        // Add any local players that might be missing (edge case)
        localGame.players?.forEach(player => {
          if (!playerMap.has(player.displayName)) {
            // Player exists locally but not on server - might be a recent join
            if (Date.now() - player.joinedAt < TIMEOUTS.PLAYER_JOIN_RECENT) {
              playerMap.set(player.displayName, player);
            }
          }
        });
        
        mergedGame = {
          ...mergedGame,
          players: Array.from(playerMap.values()),
        };
      }
      
      // Cache the latest version locally
      await db.games.put(mergedGame);
      return mergedGame;
    } else if (localGame) {
      // Server fetch failed but we have local version
      return localGame;
    }
  } else {
    // Offline - use local version if available
    if (localGame) {
      return localGame;
    }
  }

  return undefined;
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
  // Validate player state before saving
  if (!playerState || !playerState.gameCode) {
    return;
  }

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
  if (!navigator.onLine) {
    return;
  }

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
  if (games.length > 0) {
    for (const game of games) {
      await syncGameToServer(game);
    }
  }
}

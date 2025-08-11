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
  const startTime = performance.now();
  try {
    console.log(`[Storage] Syncing game ${game.gameCode} to server...`);
    const response = await fetch(`/api/game/${game.gameCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(game),
    });

    const duration = Math.round(performance.now() - startTime);
    if (response.ok) {
      console.log(
        `[Storage] ✅ Game ${game.gameCode} synced successfully (${duration}ms)`,
      );
    } else {
      console.warn(
        `[Storage] ⚠️ Game ${game.gameCode} sync failed: ${response.status} ${response.statusText} (${duration}ms)`,
      );
    }
    return response.ok;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error(
      `[Storage] ❌ Failed to sync game ${game.gameCode} to server (${duration}ms):`,
      error,
    );
    return false;
  }
}

async function fetchGameFromServer(gameCode: string): Promise<Game | null> {
  const startTime = performance.now();
  try {
    console.log(`[Storage] Fetching game ${gameCode} from server...`);
    const response = await fetch(`/api/game/${gameCode}`);
    const duration = Math.round(performance.now() - startTime);

    if (response.ok) {
      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();

        // Handle both direct game object and stringified JSON
        let game: Game;
        if (typeof data === "string") {
          // Double-stringified, parse again
          game = JSON.parse(data);
        } else if (typeof data === "object" && data !== null) {
          game = data;
        } else {
          console.error(
            `[Storage] Unexpected data type from server:`,
            typeof data,
          );
          return null;
        }

        console.log(
          `[Storage] ✅ Game ${gameCode} fetched from server (${duration}ms)`,
        );
        console.log(`[Storage] Game has winner:`, !!game.winner, game.winner);
        console.log(`[Storage] Game has ${game.players?.length || 0} players`);
        return game;
      } else {
        // Non-JSON response (likely HTML error page)
        const text = await response.text();
        console.error(
          `[Storage] ⚠️ Server returned non-JSON response for game ${gameCode} (${duration}ms)`,
        );
        console.error(`[Storage] Response preview: ${text.substring(0, 200)}`);
        return null;
      }
    } else if (response.status === 404) {
      console.log(
        `[Storage] ℹ️ Game ${gameCode} not found on server (${duration}ms)`,
      );
    } else if (response.status === 503) {
      const errorData = await response.json().catch(() => null);
      console.error(
        `[Storage] ⚠️ Storage service unavailable (${duration}ms):`,
        errorData?.details || response.statusText,
      );
    } else {
      console.warn(
        `[Storage] ⚠️ Failed to fetch game ${gameCode}: ${response.status} ${response.statusText} (${duration}ms)`,
      );
    }
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error(
      `[Storage] ❌ Failed to fetch game ${gameCode} from server (${duration}ms):`,
      error,
    );
  }
  return null;
}

async function syncPlayerStateToServer(state: PlayerState): Promise<boolean> {
  const startTime = performance.now();
  try {
    console.log(`[Storage] Syncing player state for game ${state.gameCode}...`);
    const response = await fetch(`/api/player/${state.gameCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });

    const duration = Math.round(performance.now() - startTime);
    if (response.ok) {
      console.log(
        `[Storage] ✅ Player state synced for game ${state.gameCode} (${duration}ms)`,
      );
    } else {
      console.warn(
        `[Storage] ⚠️ Player state sync failed: ${response.status} ${response.statusText} (${duration}ms)`,
      );
    }
    return response.ok;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error(
      `[Storage] ❌ Failed to sync player state (${duration}ms):`,
      error,
    );
    return false;
  }
}

// Pure functions for data operations
export async function saveGameLocal(game: Game): Promise<void> {
  // Validate game object before saving
  if (!game || !game.id || !game.gameCode) {
    console.error("[Storage] Invalid game object, skipping save:", game);
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
  console.log(`[Storage] Loading game ${gameCode}...`);

  // Get local version first as fallback
  let localGame = await db.games.where("gameCode").equals(gameCode).first();

  if (navigator.onLine) {
    // When online, always try to get the latest from server
    const serverGame = await fetchGameFromServer(gameCode);
    if (serverGame) {
      // Server version is the source of truth
      // Merge local changes if needed (preserve local admin token if it exists)
      const mergedGame = localGame?.adminToken 
        ? { ...serverGame, adminToken: localGame.adminToken }
        : serverGame;
      
      // Cache the latest version locally
      await db.games.put(mergedGame);
      console.log(
        `[Storage] ✅ Game ${gameCode} fetched from server (${serverGame.players?.length || 0} players)`,
      );
      return mergedGame;
    } else if (localGame) {
      // Server fetch failed but we have local version
      console.log(`[Storage] ⚠️ Using local cache for game ${gameCode}`);
      return localGame;
    }
  } else {
    // Offline - use local version if available
    if (localGame) {
      console.log(`[Storage] ✅ Game ${gameCode} loaded from local cache (offline)`);
      return localGame;
    } else {
      console.log(
        `[Storage] ⚠️ Offline - cannot fetch game ${gameCode} from server`,
      );
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
    console.error("[Storage] Invalid player state, skipping save:", playerState);
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
    console.log("[Storage] Offline - skipping sync");
    return;
  }

  console.log("[Storage] Processing pending sync operations...");

  const events = await db.pendingEvents.toArray();
  if (events.length > 0) {
    console.log(`[Storage] Found ${events.length} pending events`);
  }

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
    console.log(`[Storage] Syncing ${games.length} local games to server...`);
    let syncCount = 0;
    for (const game of games) {
      const success = await syncGameToServer(game);
      if (success) syncCount++;
    }
    console.log(`[Storage] ✅ Synced ${syncCount}/${games.length} games`);
  }
}

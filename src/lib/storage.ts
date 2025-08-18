import Dexie, { type Table } from "dexie";
import type { Game, PlayerState, GameEvent, Player } from "../types/types.ts";
import { STORAGE, TIMEOUTS } from "./constants";
import { GameSchema, PlayerStateSchema } from "../schemas/gameSchemas";
import { safeValidate } from "../schemas/validation";

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

const syncThrottle = new Map<string, number>();

async function syncGameToServer(game: Game): Promise<boolean> {
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
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const game = await response.json();

        if (!game || typeof game !== "object") {
          return null;
        }

        return game;
      } else {
        await response.text();
        return null;
      }
    }
  } catch (error) {}
  return null;
}

async function syncPlayerStateToServer(
  state: PlayerState,
  playerId?: string,
): Promise<boolean> {
  try {
    // Include playerId if available from store
    const stateWithId = playerId ? { ...state, playerId } : state;

    const response = await fetch(`/api/player/${state.gameCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stateWithId),
    });

    if (response.ok) {
      const data = await response.json();
      // Store the playerId for future use if returned
      if (data.playerId) {
        localStorage.setItem(`playerId-${state.gameCode}`, data.playerId);
      }
    }

    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function saveGameLocal(game: Game): Promise<void> {
  const validation = safeValidate(GameSchema, game);
  if (!validation.success) {
    console.error("Invalid game data:", validation.error);
    return;
  }

  await db.games.put(game);

  // Store admin token in localStorage if present (for creator tracking)
  if (game.adminToken) {
    localStorage.setItem(`game:${game.gameCode}:adminToken`, game.adminToken);
    localStorage.setItem(`game:${game.gameCode}:isCreator`, "true");
  }

  syncGameToServer(game).then((success) => {
    if (!success && navigator.onLine) {
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
  let localGame = await db.games.where("gameCode").equals(gameCode).first();

  if (navigator.onLine) {
    const serverGame = await fetchGameFromServer(gameCode);
    if (serverGame) {
      let mergedGame = serverGame;

      if (localGame) {
        if (localGame.adminToken) {
          mergedGame = { ...serverGame, adminToken: localGame.adminToken };
        }

        const playerMap = new Map<string, Player>();

        serverGame.players?.forEach((player) => {
          playerMap.set(player.displayName, player);
        });

        localGame.players?.forEach((player) => {
          if (!playerMap.has(player.displayName)) {
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

      await db.games.put(mergedGame);
      return mergedGame;
    } else if (localGame) {
      return localGame;
    }
  } else {
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
  const validation = safeValidate(PlayerStateSchema, playerState);
  if (!validation.success) {
    console.error("Invalid player state:", validation.error);
    return;
  }

  await db.playerStates.put(playerState);

  // Get stored playerId for this game
  const storedPlayerId = localStorage.getItem(
    `playerId-${playerState.gameCode}`,
  );

  syncPlayerStateToServer(playerState, storedPlayerId || undefined).then(
    (success) => {
      if (!success && navigator.onLine) {
        queueEvent({
          type: "GAME_RESET",
          timestamp: Date.now(),
        } as GameEvent);
      }
    },
  );
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
      await db.pendingEvents.delete(event.id!);
    } catch {
      break;
    }
  }

  const games = await db.games.toArray();
  if (games.length > 0) {
    for (const game of games) {
      await syncGameToServer(game);
    }
  }
}

// Helper functions for creator tracking
export function isGameCreator(gameCode: string): boolean {
  return localStorage.getItem(`game:${gameCode}:isCreator`) === "true";
}

export function getStoredAdminToken(gameCode: string): string | null {
  return localStorage.getItem(`game:${gameCode}:adminToken`);
}

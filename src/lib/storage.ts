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

// Pure functions for data operations
export async function saveGameLocal(game: Game): Promise<void> {
  await db.games.put(game);
}

export async function loadLocalGames(): Promise<Game[]> {
  return await db.games.toArray();
}

export async function loadGameByCode(
  gameCode: string,
): Promise<Game | undefined> {
  return await db.games.where("gameCode").equals(gameCode).first();
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
  await db.playerStates.put(playerState);
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
      // TODO: Send to server when backend is ready
      // await sendEventToServer(event);
      await db.pendingEvents.delete(event.id!);
    } catch {
      // Keep in queue for retry
      break;
    }
  }
}

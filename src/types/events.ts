import type { Player, BingoItem } from "./types";

// Event payload types
export interface MarkPayload {
  readonly itemId: string;
  readonly playerId: string;
  readonly displayName: string;
  readonly position: number;
  readonly markedAt: number;
}

export interface PlayerPayload {
  readonly player: Player;
  readonly joinedAt: number;
}


export interface ItemPayload {
  readonly item: BingoItem;
  readonly addedAt: number;
}

// Discriminated union for all game events
export type GameEventV2 =
  | { readonly type: "ITEM_MARKED"; readonly payload: MarkPayload }
  | { readonly type: "ITEM_UNMARKED"; readonly payload: MarkPayload }
  | { readonly type: "PLAYER_JOINED"; readonly payload: PlayerPayload }
  | { readonly type: "GAME_RESET"; readonly timestamp: number }
  | { readonly type: "ITEM_ADDED"; readonly payload: ItemPayload }
  | {
      readonly type: "PLAYER_UPDATED";
      readonly payload: {
        readonly playerId: string;
        readonly lastActiveAt: number;
      };
    };

// Type guard functions
export function isItemMarkedEvent(
  event: GameEventV2,
): event is Extract<GameEventV2, { type: "ITEM_MARKED" }> {
  return event.type === "ITEM_MARKED";
}

export function isPlayerJoinedEvent(
  event: GameEventV2,
): event is Extract<GameEventV2, { type: "PLAYER_JOINED" }> {
  return event.type === "PLAYER_JOINED";
}


// Event handler type
export type EventHandler<T extends GameEventV2 = GameEventV2> = (
  event: T,
) => void | Promise<void>;

// Event handler map type
export type EventHandlers = {
  readonly [K in GameEventV2["type"]]?: EventHandler<
    Extract<GameEventV2, { type: K }>
  >;
};

// Exhaustive event handler
export function handleGameEvent(
  event: GameEventV2,
  handlers: EventHandlers,
): void {
  const handler = handlers[event.type];
  if (handler) {
    (handler as EventHandler)(event);
  }
}

// Helper to ensure exhaustive handling in switch statements
export function assertNever(x: never): never {
  throw new Error(`Unexpected event type: ${x}`);
}

// Core domain types - all readonly for immutability

export interface Game {
  readonly id: string;
  readonly adminToken: string; // 32-char secret for admin access
  readonly gameCode: string; // 6-char code for sharing
  readonly title: string;
  readonly items: readonly BingoItem[];
  readonly settings: GameSettings;
  readonly createdAt: number;
  readonly lastModifiedAt: number;
  // Multiplayer fields
  readonly players: readonly Player[];
}

export interface BingoItem {
  readonly id: string;
  readonly text: string;
  readonly position: number; // Position in grid
}

export interface GameSettings {
  readonly gridSize: number; // NxN grid - any positive integer
  readonly requireFullCard: boolean;
  readonly freeSpace: boolean; // Center free space
}

export interface PlayerState {
  readonly gameCode: string;
  readonly displayName: string;
  readonly itemCounts: Record<number, number>; // Position -> count of times seen
  readonly lastSyncAt: number;
}

// NEW: Player info visible to all players
export interface Player {
  readonly id: string;
  readonly displayName: string;
  readonly joinedAt: number;
  readonly lastSeenAt: number; // When they last opened the game
  readonly isOnline?: boolean; // Optional: currently viewing the game
}

// Event sourcing for sync
export type GameEvent =
  | { type: "ITEM_ADDED"; itemId: string; text: string; timestamp: number }
  | { type: "ITEM_MARKED"; itemId: string; playerId: string; timestamp: number }
  | { type: "GAME_RESET"; timestamp: number }
  // NEW: Multiplayer events
  | { type: "PLAYER_JOINED"; player: Player; timestamp: number }
  | {
      type: "PLAYER_UPDATED";
      playerId: string;
      lastActiveAt: number;
      timestamp: number;
    };

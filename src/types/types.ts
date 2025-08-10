// Core domain types - all readonly for immutability
export interface Game {
  readonly id: string;
  readonly adminToken: string;  // 32-char secret for admin access
  readonly gameCode: string;     // 6-char code for sharing
  readonly title: string;
  readonly items: readonly BingoItem[];
  readonly settings: GameSettings;
  readonly createdAt: number;
  readonly lastModifiedAt: number;
}

export interface BingoItem {
  readonly id: string;
  readonly text: string;
  readonly position: number;  // Position in grid
}

export interface GameSettings {
  readonly gridSize: 3 | 4 | 5;  // NxN grid
  readonly requireFullCard: boolean;
  readonly freeSpace: boolean;  // Center free space
}

export interface PlayerState {
  readonly gameCode: string;
  readonly displayName: string;
  readonly markedPositions: readonly number[];  // Grid positions (0-24 for 5x5)
  readonly lastSyncAt: number;
}

// Event sourcing for sync
export type GameEvent = 
  | { type: 'ITEM_ADDED'; itemId: string; text: string; timestamp: number }
  | { type: 'ITEM_MARKED'; itemId: string; playerId: string; timestamp: number }
  | { type: 'ITEM_UNMARKED'; itemId: string; playerId: string; timestamp: number }
  | { type: 'GAME_RESET'; timestamp: number };
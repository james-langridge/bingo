import { z } from "zod";

/**
 * Base schemas for game entities
 */

export const GameSettingsSchema = z.object({
  gridSize: z.number().min(3).max(7),
  requireFullCard: z.boolean(),
  freeSpace: z.boolean(),
});

export const BingoItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().max(500),
  position: z.number().min(0),
});

export const PlayerSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(50),
  joinedAt: z.number().positive(),
  lastSeenAt: z.number().positive(),
  isOnline: z.boolean().optional(),
});

export const GameSchema = z.object({
  id: z.string().uuid(),
  adminToken: z
    .string()
    .regex(/^[a-z0-9]{32}$/)
    .optional(),
  gameCode: z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/),
  title: z.string().min(1).max(100),
  items: z.array(BingoItemSchema),
  settings: GameSettingsSchema,
  createdAt: z.number().positive(),
  lastModifiedAt: z.number().positive(),
  players: z.array(PlayerSchema),
});

export const PlayerStateSchema = z.object({
  gameCode: z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/),
  displayName: z.string().min(1).max(50),
  itemCounts: z.record(z.string(), z.number()),
  lastSyncAt: z.number().positive(),
});

export const GameEventSchema = z.object({
  type: z.enum([
    "PLAYER_JOINED",
    "PLAYER_LEFT",
    "ITEM_MARKED",
    "ITEM_UNMARKED",
    "GAME_RESET",
  ]),
  timestamp: z.number().positive(),
  playerId: z.string().uuid().optional(),
  data: z.unknown().optional(),
});

/**
 * API Request/Response schemas
 */

export const CreateGameRequestSchema = z.object({
  title: z.string().min(1).max(100),
});

export const UpdateGameItemsRequestSchema = z.object({
  items: z.array(BingoItemSchema),
});

export const JoinGameRequestSchema = z.object({
  gameCode: z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/),
  displayName: z.string().min(1).max(50),
});

export const MarkPositionRequestSchema = z.object({
  position: z.number().min(0),
});

export const GameChangesResponseSchema = z.object({
  version: z.string(),
  lastModifiedAt: z.number().positive(),
  timestamp: z.number().positive(),
  changes: z
    .object({
      fullUpdate: z.boolean().optional(),
      game: GameSchema.optional(),
      players: z.array(PlayerSchema).optional(),
      items: z.array(BingoItemSchema).optional(),
    })
    .optional(),
});

/**
 * Type exports for TypeScript
 */

export type GameSettings = z.infer<typeof GameSettingsSchema>;
export type BingoItem = z.infer<typeof BingoItemSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Game = z.infer<typeof GameSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;

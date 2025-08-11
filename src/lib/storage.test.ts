import { describe, test, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from "vitest";
import "fake-indexeddb/auto";
import {
  db,
  saveGameLocal,
  loadLocalGames,
  loadGameByCode,
  loadGameByAdminToken,
  deleteGameLocal,
  savePlayerState,
  loadPlayerState,
  queueEvent,
  processPendingEvents,
} from "./storage";
import type { Game, PlayerState, GameEvent } from "../types/types";

// Mock game data
const mockGame: Game = {
  id: "test-id-123",
  adminToken: "test-admin-token-32chars1234567890ab",
  gameCode: "ABC123",
  title: "Test Game",
  items: [
    { id: "item-1", text: "Item 1", position: 0 },
    { id: "item-2", text: "Item 2", position: 1 },
  ],
  settings: {
    gridSize: 5,
    requireFullCard: false,
    freeSpace: true,
  },
  createdAt: Date.now(),
  lastModifiedAt: Date.now(),
  players: [],
};

const mockPlayerState: PlayerState = {
  gameCode: "ABC123",
  displayName: "Player 1",
  markedPositions: [0, 5, 10],
  lastSyncAt: Date.now(),
};

describe("storage", () => {
  beforeAll(() => {
    // Mock fetch globally for all tests
    global.fetch = vi.fn();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Clear database before each test
    await db.games.clear();
    await db.playerStates.clear();
    await db.pendingEvents.clear();
    
    // Reset fetch mock for each test
    vi.mocked(global.fetch).mockReset();
    // Default to successful responses
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("saveGameLocal", () => {
    test("saves a game to local storage", async () => {
      await saveGameLocal(mockGame);
      const games = await db.games.toArray();
      expect(games).toHaveLength(1);
      expect(games[0]).toEqual(mockGame);
    });

    test("updates existing game with same ID", async () => {
      await saveGameLocal(mockGame);
      const updatedGame = { ...mockGame, title: "Updated Title" };
      await saveGameLocal(updatedGame);

      const games = await db.games.toArray();
      expect(games).toHaveLength(1);
      expect(games[0].title).toBe("Updated Title");
    });

    test("handles multiple games", async () => {
      const game2 = { ...mockGame, id: "game-456", gameCode: "DEF456" };
      await saveGameLocal(mockGame);
      await saveGameLocal(game2);

      const games = await db.games.toArray();
      expect(games).toHaveLength(2);
    });
  });

  describe("loadLocalGames", () => {
    test("returns empty array when no games exist", async () => {
      const games = await loadLocalGames();
      expect(games).toEqual([]);
    });

    test("returns all saved games", async () => {
      const game2 = { ...mockGame, id: "game-456", gameCode: "DEF456" };
      await saveGameLocal(mockGame);
      await saveGameLocal(game2);

      const games = await loadLocalGames();
      expect(games).toHaveLength(2);
      expect(games.map((g) => g.id)).toContain("test-id-123");
      expect(games.map((g) => g.id)).toContain("game-456");
    });

    test("returns games with all properties intact", async () => {
      await saveGameLocal(mockGame);
      const games = await loadLocalGames();
      expect(games[0]).toEqual(mockGame);
    });
  });

  describe("loadGameByCode", () => {
    test("returns undefined when game not found", async () => {
      // Mock online state
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });
      
      // Mock fetch to return 404 for this test
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(null, {
          status: 404,
          statusText: "Not Found",
        })
      );
      
      const game = await loadGameByCode("NOTFOUND");
      expect(game).toBeUndefined();
    });

    test("returns game with matching code", async () => {
      await saveGameLocal(mockGame);
      const game = await loadGameByCode("ABC123");
      expect(game).toEqual(mockGame);
    });

    test("returns correct game when multiple games exist", async () => {
      const game2 = {
        ...mockGame,
        id: "game-456",
        gameCode: "DEF456",
        title: "Game 2",
      };
      await saveGameLocal(mockGame);
      await saveGameLocal(game2);

      const found = await loadGameByCode("DEF456");
      expect(found?.title).toBe("Game 2");
    });

    test("is case sensitive", async () => {
      await saveGameLocal(mockGame);
      
      // Mock online state
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });
      
      // Mock fetch to return 404 for this test
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(null, {
          status: 404,
          statusText: "Not Found",
        })
      );
      
      const game = await loadGameByCode("abc123");
      expect(game).toBeUndefined();
    });
  });

  describe("loadGameByAdminToken", () => {
    test("returns undefined when token not found", async () => {
      const game = await loadGameByAdminToken("notfound");
      expect(game).toBeUndefined();
    });

    test("returns game with matching admin token", async () => {
      await saveGameLocal(mockGame);
      const game = await loadGameByAdminToken(
        "test-admin-token-32chars1234567890ab",
      );
      expect(game).toEqual(mockGame);
    });

    test("returns correct game when multiple games exist", async () => {
      const game2 = {
        ...mockGame,
        id: "game-456",
        adminToken: "different12345678901234567890123",
        title: "Game 2",
      };
      await saveGameLocal(mockGame);
      await saveGameLocal(game2);

      const found = await loadGameByAdminToken(
        "different12345678901234567890123",
      );
      expect(found?.title).toBe("Game 2");
    });
  });

  describe("deleteGameLocal", () => {
    test("deletes game by ID", async () => {
      await saveGameLocal(mockGame);
      await deleteGameLocal("test-id-123");

      const games = await loadLocalGames();
      expect(games).toHaveLength(0);
    });

    test("only deletes specified game", async () => {
      const game2 = { ...mockGame, id: "game-456", gameCode: "DEF456" };
      await saveGameLocal(mockGame);
      await saveGameLocal(game2);

      await deleteGameLocal("test-id-123");

      const games = await loadLocalGames();
      expect(games).toHaveLength(1);
      expect(games[0].id).toBe("game-456");
    });

    test("handles deletion of non-existent game", async () => {
      await expect(deleteGameLocal("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("savePlayerState", () => {
    test("saves player state", async () => {
      await savePlayerState(mockPlayerState);
      const states = await db.playerStates.toArray();
      expect(states).toHaveLength(1);
      expect(states[0]).toEqual(mockPlayerState);
    });

    test("updates existing player state for same game code", async () => {
      await savePlayerState(mockPlayerState);
      const updated = { ...mockPlayerState, markedPositions: [1, 2, 3] };
      await savePlayerState(updated);

      const states = await db.playerStates.toArray();
      expect(states).toHaveLength(1);
      expect(states[0].markedPositions).toEqual([1, 2, 3]);
    });

    test("handles multiple game states", async () => {
      const state2 = { ...mockPlayerState, gameCode: "DEF456" };
      await savePlayerState(mockPlayerState);
      await savePlayerState(state2);

      const states = await db.playerStates.toArray();
      expect(states).toHaveLength(2);
    });
  });

  describe("loadPlayerState", () => {
    test("returns undefined when no state exists", async () => {
      const state = await loadPlayerState("NOTFOUND");
      expect(state).toBeUndefined();
    });

    test("returns player state for game code", async () => {
      await savePlayerState(mockPlayerState);
      const state = await loadPlayerState("ABC123");
      expect(state).toEqual(mockPlayerState);
    });

    test("returns correct state when multiple states exist", async () => {
      const state2 = {
        ...mockPlayerState,
        gameCode: "DEF456",
        displayName: "Player 2",
      };
      await savePlayerState(mockPlayerState);
      await savePlayerState(state2);

      const found = await loadPlayerState("DEF456");
      expect(found?.displayName).toBe("Player 2");
    });
  });

  describe("queueEvent", () => {
    test("adds event to pending queue", async () => {
      const event: GameEvent = {
        type: "ITEM_MARKED",
        itemId: "item-1",
        playerId: "player-1",
        timestamp: Date.now(),
      };

      await queueEvent(event);
      const events = await db.pendingEvents.toArray();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject(event);
    });

    test("assigns auto-incrementing ID", async () => {
      const event1: GameEvent = {
        type: "ITEM_MARKED",
        itemId: "item-1",
        playerId: "player-1",
        timestamp: Date.now(),
      };
      const event2: GameEvent = {
        type: "ITEM_UNMARKED",
        itemId: "item-2",
        playerId: "player-1",
        timestamp: Date.now(),
      };

      await queueEvent(event1);
      await queueEvent(event2);

      const events = await db.pendingEvents.toArray();
      expect(events[0].id).toBeDefined();
      expect(events[1].id).toBeDefined();
      expect(events[1].id).toBeGreaterThan(events[0].id!);
    });

    test("handles different event types", async () => {
      const events: GameEvent[] = [
        {
          type: "ITEM_ADDED",
          itemId: "1",
          text: "Text",
          timestamp: Date.now(),
        },
        {
          type: "ITEM_MARKED",
          itemId: "1",
          playerId: "p1",
          timestamp: Date.now(),
        },
        {
          type: "ITEM_UNMARKED",
          itemId: "1",
          playerId: "p1",
          timestamp: Date.now(),
        },
        { type: "GAME_RESET", timestamp: Date.now() },
      ];

      for (const event of events) {
        await queueEvent(event);
      }

      const stored = await db.pendingEvents.toArray();
      expect(stored).toHaveLength(4);
    });
  });

  describe("processPendingEvents", () => {
    test("does nothing when offline", async () => {
      // Mock offline state
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      const event: GameEvent = {
        type: "ITEM_MARKED",
        itemId: "item-1",
        playerId: "player-1",
        timestamp: Date.now(),
      };

      await queueEvent(event);
      await processPendingEvents();

      const events = await db.pendingEvents.toArray();
      expect(events).toHaveLength(1);
    });

    test("processes events when online", async () => {
      // Mock online state
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });

      const event: GameEvent = {
        type: "ITEM_MARKED",
        itemId: "item-1",
        playerId: "player-1",
        timestamp: Date.now(),
      };

      await queueEvent(event);
      await processPendingEvents();

      // Events should be deleted after processing (TODO comment in actual code)
      const events = await db.pendingEvents.toArray();
      expect(events).toHaveLength(0);
    });

    test("processes multiple events in order", async () => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });

      const events: GameEvent[] = [
        { type: "ITEM_MARKED", itemId: "1", playerId: "p1", timestamp: 1000 },
        { type: "ITEM_MARKED", itemId: "2", playerId: "p1", timestamp: 2000 },
        { type: "ITEM_MARKED", itemId: "3", playerId: "p1", timestamp: 3000 },
      ];

      for (const event of events) {
        await queueEvent(event);
      }

      await processPendingEvents();

      const remaining = await db.pendingEvents.toArray();
      expect(remaining).toHaveLength(0);
    });
  });

  describe("database initialization", () => {
    test("database has correct name", () => {
      expect(db.name).toBe("BingoDB");
    });

    test("database has correct tables", () => {
      expect(db.games).toBeDefined();
      expect(db.playerStates).toBeDefined();
      expect(db.pendingEvents).toBeDefined();
    });

    test("database version is set", () => {
      expect(db.verno).toBe(1);
    });
  });

  describe("data persistence", () => {
    test("data persists across operations", async () => {
      await saveGameLocal(mockGame);
      await savePlayerState(mockPlayerState);

      const games = await loadLocalGames();
      const playerState = await loadPlayerState("ABC123");

      expect(games).toHaveLength(1);
      expect(playerState).toBeDefined();
    });

    test("handles concurrent operations", async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const game = { ...mockGame, id: `game-${i}`, gameCode: `CODE${i}` };
        promises.push(saveGameLocal(game));
      }

      await Promise.all(promises);
      const games = await loadLocalGames();
      expect(games).toHaveLength(10);
    });
  });
});

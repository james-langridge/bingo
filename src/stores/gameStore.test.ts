import {
  describe,
  test,
  expect,
  beforeEach,
  vi,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import "fake-indexeddb/auto";
import { useGameStore } from "./gameStore";
import { db } from "../lib/storage";
import type { Game, BingoItem } from "../types/types";

// Mock crypto.randomUUID
vi.mock("crypto", () => ({
  randomUUID: vi.fn(
    () => "test-uuid-" + Math.random().toString(36).substr(2, 9),
  ),
}));

describe("gameStore", () => {
  beforeAll(() => {
    // Mock fetch globally for all tests
    global.fetch = vi.fn();

    // Mock navigator.onLine to be false by default for tests
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Clear database and reset store before each test
    await db.games.clear();
    await db.playerStates.clear();
    await db.pendingEvents.clear();

    // Reset zustand store
    useGameStore.setState({
      currentGame: null,
      playerState: null,
      localGames: [],
      isLoading: false,
      currentPlayerId: null,
    });

    // Reset fetch mock for each test
    vi.mocked(global.fetch).mockReset();
    // Default to successful responses
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    // Set offline by default for tests (to use local storage only)
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createGame", () => {
    test("creates a new game with correct properties", async () => {
      const { result } = renderHook(() => useGameStore());

      let game: Game;
      await act(async () => {
        game = await result.current.createGame("Test Game");
      });

      expect(game!).toBeDefined();
      expect(game!.title).toBe("Test Game");
      expect(game!.gameCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(game!.adminToken).toMatch(/^[a-z0-9]{32}$/);
      expect(game!.items).toEqual([]);
      expect(game!.settings).toEqual({
        gridSize: 5,
        requireFullCard: false,
        freeSpace: true,
      });
    });

    test("updates currentGame state", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        await result.current.createGame("Test Game");
      });

      expect(result.current.currentGame).toBeDefined();
      expect(result.current.currentGame?.title).toBe("Test Game");
    });

    test("adds game to localGames", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        await result.current.createGame("Test Game");
      });

      expect(result.current.localGames).toHaveLength(1);
      expect(result.current.localGames[0].title).toBe("Test Game");
      expect(result.current.localGames[0].adminToken).toBeDefined();
    });

    test("persists game to storage", async () => {
      const { result } = renderHook(() => useGameStore());

      let game: Game;
      await act(async () => {
        game = await result.current.createGame("Test Game");
      });

      const storedGames = await db.games.toArray();
      expect(storedGames).toHaveLength(1);
      expect(storedGames[0].id).toBe(game!.id);
    });

    test("creates multiple games with unique codes", async () => {
      const { result } = renderHook(() => useGameStore());

      const games: Game[] = [];
      await act(async () => {
        games.push(await result.current.createGame("Game 1"));
        games.push(await result.current.createGame("Game 2"));
        games.push(await result.current.createGame("Game 3"));
      });

      const codes = games.map((g) => g.gameCode);
      expect(new Set(codes).size).toBe(3);
    });
  });

  describe("loadGame", () => {
    test("loads existing game by code", async () => {
      const { result } = renderHook(() => useGameStore());

      let game: Game;
      await act(async () => {
        game = await result.current.createGame("Test Game");
      });

      // Clear current game to test loading
      await act(async () => {
        useGameStore.setState({ currentGame: null });
      });

      await act(async () => {
        await result.current.loadGame(game!.gameCode);
      });

      expect(result.current.currentGame).toBeDefined();
      expect(result.current.currentGame?.id).toBe(game!.id);
    });

    test("loads associated player state", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        const game = await result.current.createGame("Test Game");
        await result.current.joinGame(game.gameCode, "Player 1");
      });

      const gameCode = result.current.currentGame!.gameCode;

      // Clear states to test loading
      await act(async () => {
        useGameStore.setState({ currentGame: null, playerState: null });
      });

      await act(async () => {
        await result.current.loadGame(gameCode);
      });

      expect(result.current.playerState).toBeDefined();
      expect(result.current.playerState?.displayName).toBe("Player 1");
    });

    test("sets currentGame to null if game not found", async () => {
      const { result } = renderHook(() => useGameStore());

      // Mock fetch to return 404 for this test
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(null, {
          status: 404,
          statusText: "Not Found",
        }),
      );

      await act(async () => {
        await result.current.loadGame("NOTFOUND");
      });

      expect(result.current.currentGame).toBeNull();
    });

    test("sets loading state correctly", async () => {
      const { result } = renderHook(() => useGameStore());

      // Mock fetch to return 404 for this test
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(null, {
          status: 404,
          statusText: "Not Found",
        }),
      );

      await act(async () => {
        await result.current.loadGame("ANYCODE");
      });

      // Check loading is false after completion
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("loadGameAsAdmin", () => {
    test("loads game with valid admin token", async () => {
      const { result } = renderHook(() => useGameStore());

      let game: Game;
      await act(async () => {
        game = await result.current.createGame("Admin Game");
      });

      await act(async () => {
        useGameStore.setState({ currentGame: null });
      });

      await act(async () => {
        await result.current.loadGameAsAdmin(game!.gameCode, game!.adminToken);
      });

      expect(result.current.currentGame).toBeDefined();
      expect(result.current.currentGame?.id).toBe(game!.id);
    });

    test("throws error with invalid admin token", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        await result.current.createGame("Admin Game");
        useGameStore.setState({ currentGame: null });
      });

      const gameCode = result.current.localGames[0].gameCode;

      await expect(
        act(async () => {
          await result.current.loadGameAsAdmin(gameCode, "wrong-token");
        }),
      ).rejects.toThrow("Invalid admin token");
    });

    test("sets currentGame to null on invalid token", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        await result.current.createGame("Admin Game");
      });

      const gameCode = result.current.currentGame!.gameCode;

      try {
        await act(async () => {
          await result.current.loadGameAsAdmin(gameCode, "wrong-token");
        });
      } catch {
        // Expected error
      }

      expect(result.current.currentGame).toBeNull();
    });
  });

  describe("updateGameItems", () => {
    test("updates game items", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        await result.current.createGame("Test Game");
      });

      const newItems: BingoItem[] = [
        { id: crypto.randomUUID(), text: "Item 1", position: 0 },
        { id: crypto.randomUUID(), text: "Item 2", position: 1 },
      ];

      await act(async () => {
        await result.current.updateGameItems(newItems);
      });

      expect(result.current.currentGame?.items).toEqual(newItems);
    });

    test("updates lastModifiedAt timestamp", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        await result.current.createGame("Test Game");
      });

      const originalTimestamp = result.current.currentGame!.lastModifiedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      await act(async () => {
        await result.current.updateGameItems([]);
      });

      expect(result.current.currentGame!.lastModifiedAt).toBeGreaterThan(
        originalTimestamp,
      );
    });

    test("persists changes to storage", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        await result.current.createGame("Test Game");
      });

      const newItems: BingoItem[] = [
        { id: crypto.randomUUID(), text: "Updated Item", position: 0 },
      ];

      await act(async () => {
        await result.current.updateGameItems(newItems);
      });

      const storedGame = await db.games.get(result.current.currentGame!.id);
      expect(storedGame?.items).toEqual(newItems);
    });

    test("does nothing if no current game", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        await result.current.updateGameItems([]);
      });

      expect(result.current.currentGame).toBeNull();
    });
  });

  describe("deleteGame", () => {
    test("deletes game from storage", async () => {
      const { result } = renderHook(() => useGameStore());

      let game: Game;
      await act(async () => {
        game = await result.current.createGame("To Delete");
      });

      await act(async () => {
        await result.current.deleteGame(game!.id);
      });

      const storedGames = await db.games.toArray();
      expect(storedGames).toHaveLength(0);
    });

    test("removes game from localGames", async () => {
      const { result } = renderHook(() => useGameStore());

      let game: Game;
      await act(async () => {
        game = await result.current.createGame("To Delete");
      });

      await act(async () => {
        await result.current.deleteGame(game!.id);
      });

      expect(result.current.localGames).toHaveLength(0);
    });

    test("clears currentGame if it matches deleted game", async () => {
      const { result } = renderHook(() => useGameStore());

      let game: Game;
      await act(async () => {
        game = await result.current.createGame("To Delete");
      });

      await act(async () => {
        await result.current.deleteGame(game!.id);
      });

      expect(result.current.currentGame).toBeNull();
    });

    test("preserves other games", async () => {
      const { result } = renderHook(() => useGameStore());

      let game1: Game, game2: Game;
      await act(async () => {
        game1 = await result.current.createGame("Game 1");
        game2 = await result.current.createGame("Game 2");
      });

      await act(async () => {
        await result.current.deleteGame(game1!.id);
      });

      expect(result.current.localGames).toHaveLength(1);
      expect(result.current.localGames[0].id).toBe(game2!.id);
    });
  });

  describe("joinGame", () => {
    test("creates player state for game", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        const game = await result.current.createGame("Test Game");
        await result.current.joinGame(game.gameCode, "Player Name");
      });

      expect(result.current.playerState).toBeDefined();
      expect(result.current.playerState?.displayName).toBe("Player Name");
      expect(result.current.playerState?.gameCode).toBe(
        result.current.currentGame?.gameCode,
      );
      expect(result.current.playerState?.itemCounts).toEqual({});
    });

    test("persists player state to storage", async () => {
      const { result } = renderHook(() => useGameStore());

      let gameCode: string;
      await act(async () => {
        const game = await result.current.createGame("Test Game");
        gameCode = game.gameCode;
        await result.current.joinGame(gameCode, "Player Name");
      });

      const storedState = await db.playerStates.get(gameCode!);
      expect(storedState).toBeDefined();
      expect(storedState?.displayName).toBe("Player Name");
    });

    test("throws error if game not found", async () => {
      const { result } = renderHook(() => useGameStore());

      // Mock fetch to return 404 for non-existent game
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(null, {
          status: 404,
          statusText: "Not Found",
        }),
      );

      await expect(
        act(async () => {
          await result.current.joinGame("NOTFOUND", "Player");
        }),
      ).rejects.toThrow("Game not found");
    });

    test("sets currentGame when joining", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        const game = await result.current.createGame("Test Game");
        useGameStore.setState({ currentGame: null });
        await result.current.joinGame(game.gameCode, "Player");
      });

      expect(result.current.currentGame).toBeDefined();
      expect(result.current.currentGame?.title).toBe("Test Game");
    });
  });

  describe("markPosition", () => {
    test("increments count for position", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        const game = await result.current.createGame("Test Game");
        await result.current.joinGame(game.gameCode, "Player");
      });

      await act(async () => {
        result.current.markPosition(5);
      });

      expect(result.current.playerState?.itemCounts[5]).toBe(1);
    });

    test("increments count on repeated clicks", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        const game = await result.current.createGame("Test Game");
        await result.current.joinGame(game.gameCode, "Player");
        result.current.markPosition(5);
      });

      await act(async () => {
        result.current.markPosition(5);
      });

      expect(result.current.playerState?.itemCounts[5]).toBe(2);
    });

    test("handles multiple positions", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        const game = await result.current.createGame("Test Game");
        await result.current.joinGame(game.gameCode, "Player");
      });

      await act(async () => {
        result.current.markPosition(0);
        result.current.markPosition(5);
        result.current.markPosition(10);
      });

      expect(result.current.playerState?.itemCounts[0]).toBe(1);
      expect(result.current.playerState?.itemCounts[5]).toBe(1);
      expect(result.current.playerState?.itemCounts[10]).toBe(1);
    });

    test("updates lastSyncAt timestamp", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        const game = await result.current.createGame("Test Game");
        await result.current.joinGame(game.gameCode, "Player");
      });

      const originalSync = result.current.playerState!.lastSyncAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await act(async () => {
        result.current.markPosition(5);
      });

      expect(result.current.playerState!.lastSyncAt).toBeGreaterThan(
        originalSync,
      );
    });

    test("persists changes to storage", async () => {
      const { result } = renderHook(() => useGameStore());

      let gameCode: string;
      await act(async () => {
        const game = await result.current.createGame("Test Game");
        gameCode = game.gameCode;
        await result.current.joinGame(gameCode, "Player");
      });

      await act(async () => {
        result.current.markPosition(5);
      });

      await waitFor(async () => {
        const storedState = await db.playerStates.get(gameCode!);
        expect(storedState?.itemCounts[5]).toBe(1);
      });
    });

    test("does nothing if no player state", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        result.current.markPosition(5);
      });

      expect(result.current.playerState).toBeNull();
    });
  });

  describe("initialize", () => {
    test("loads all local games", async () => {
      const { result } = renderHook(() => useGameStore());

      // Create some games
      await act(async () => {
        await result.current.createGame("Game 1");
        await result.current.createGame("Game 2");
        await result.current.createGame("Game 3");
      });

      // Reset localGames to test initialization
      await act(async () => {
        useGameStore.setState({ localGames: [] });
      });

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.localGames).toHaveLength(3);
      expect(result.current.localGames.map((g) => g.title)).toContain("Game 1");
      expect(result.current.localGames.map((g) => g.title)).toContain("Game 2");
      expect(result.current.localGames.map((g) => g.title)).toContain("Game 3");
    });

    test("sets loading state correctly", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("handles empty storage", async () => {
      const { result } = renderHook(() => useGameStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.localGames).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });
});

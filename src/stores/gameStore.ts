import { create } from "zustand";
import { produce } from "immer";
import type { WritableDraft } from "immer";
import type {
  Game,
  PlayerState,
  BingoItem,
  PlayerItemCounts,
} from "../types/types.ts";
import { loadPlayerState, saveGameLocal } from "../lib/storage";
import { getSyncManager } from "../lib/syncManager";

import {
  createGame,
  loadGame,
  saveGameItems,
  deleteGame,
  initializeGames,
} from "./actions/gameActions";
import {
  joinGame as joinGameAction,
  persistPlayerState,
} from "./actions/playerActions";

interface GameStore {
  currentGame: Game | null;
  playerState: PlayerState | null;
  allPlayerCounts: PlayerItemCounts[]; // Track all players' counts
  localGames: {
    id: string;
    gameCode: string;
    adminToken?: string;
    title: string;
  }[];
  isLoading: boolean;
  currentPlayerId: string | null;
  isConnected: boolean;

  createGame: (title: string) => Promise<Game>;
  loadGame: (gameCode: string) => Promise<void>;
  loadGameAsAdmin: (gameCode: string, adminToken: string) => Promise<void>;
  updateGameItems: (items: BingoItem[]) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;

  joinGame: (gameCode: string, displayName: string) => Promise<void>;
  markPosition: (position: number) => void;

  handleRealtimeUpdate: (game: Game) => void;
  setConnectionStatus: (isConnected: boolean) => void;
  fetchPlayerCounts: () => Promise<void>;

  initialize: () => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentGame: null,
  playerState: null,
  allPlayerCounts: [],
  localGames: [],
  isLoading: false,
  currentPlayerId: null,
  isConnected: false,

  createGame: async (title) => {
    const game = await createGame(title);
    set(
      produce((draft: WritableDraft<GameStore>) => {
        draft.currentGame = game as WritableDraft<Game>;
        draft.localGames.push({
          id: game.id,
          gameCode: game.gameCode,
          adminToken: game.adminToken,
          title: game.title,
        });
      }),
    );
    return game;
  },

  loadGame: async (gameCode) => {
    set({ isLoading: true });

    try {
      const game = await loadGame(gameCode);
      const playerState = await loadPlayerState(gameCode);

      if (!game) {
        set({
          currentGame: null,
          playerState: null,
          isLoading: false,
        });
        return;
      }

      let playerId = null;
      if (playerState) {
        const existingPlayer = game.players.find(
          (p) => p.displayName === playerState.displayName,
        );
        if (existingPlayer) {
          playerId = existingPlayer.id;
        } else {
          playerId = crypto.randomUUID();
        }
      }

      set({
        currentGame: game,
        playerState: playerState || null,
        currentPlayerId: playerId,
        isLoading: false,
      });

      // Fetch initial player counts
      get().fetchPlayerCounts();

      const syncManager = getSyncManager();
      syncManager.connect(gameCode, {
        onGameUpdate: (updatedGame) => {
          get().handleRealtimeUpdate(updatedGame);
          // Fetch updated player counts when game updates
          get().fetchPlayerCounts();
        },
        onConnectionChange: (isConnected) =>
          get().setConnectionStatus(isConnected),
      });
    } catch (error) {
      set({
        currentGame: null,
        playerState: null,
        isLoading: false,
      });
    }
  },

  loadGameAsAdmin: async (gameCode, adminToken) => {
    set({ isLoading: true });

    const game = await loadGame(gameCode);

    if (game && game.adminToken === adminToken) {
      set({
        currentGame: game,
        isLoading: false,
      });
    } else {
      set({
        currentGame: null,
        isLoading: false,
      });
      throw new Error("Invalid admin token");
    }
  },

  updateGameItems: async (items) => {
    const { currentGame } = get();
    if (!currentGame) return;

    const updatedGame = await saveGameItems(currentGame, items);

    set(
      produce((draft: WritableDraft<GameStore>) => {
        draft.currentGame = updatedGame as WritableDraft<Game>;
        const gameIndex = draft.localGames.findIndex(
          (g) => g.id === updatedGame.id,
        );
        if (gameIndex >= 0) {
          draft.localGames[gameIndex] = {
            id: updatedGame.id,
            gameCode: updatedGame.gameCode,
            adminToken: updatedGame.adminToken,
            title: updatedGame.title,
          };
        }
      }),
    );
  },

  deleteGame: async (gameId) => {
    await deleteGame(gameId);

    set(
      produce((draft: WritableDraft<GameStore>) => {
        draft.localGames = draft.localGames.filter((g) => g.id !== gameId);
        if (draft.currentGame?.id === gameId) {
          draft.currentGame = null;
        }
      }),
    );
  },

  joinGame: async (gameCode, displayName) => {
    const { game, playerState, playerId } = await joinGameAction(
      gameCode,
      displayName,
    );

    set({
      currentGame: game,
      playerState,
      currentPlayerId: playerId,
    });

    const syncManager = getSyncManager();
    syncManager.connect(gameCode, {
      onGameUpdate: (updatedGame) => get().handleRealtimeUpdate(updatedGame),
      onConnectionChange: (isConnected) =>
        get().setConnectionStatus(isConnected),
    });
  },

  markPosition: (position) => {
    const { currentGame, playerState } = get();
    if (!currentGame || !playerState) return;

    set(
      produce((draft: WritableDraft<GameStore>) => {
        if (!draft.playerState || !draft.currentGame) return;

        const currentCounts = draft.playerState.itemCounts as Record<
          number,
          number
        >;
        const currentCount = currentCounts[position] || 0;

        // Increment the count for this position
        (draft.playerState.itemCounts as Record<number, number>)[position] =
          currentCount + 1;
        (draft.playerState.lastSyncAt as number) = Date.now();
      }),
    );

    const updatedState = get();
    if (updatedState.playerState && updatedState.currentGame) {
      Promise.all([
        persistPlayerState(updatedState.playerState),
        saveGameLocal(updatedState.currentGame),
      ]).catch(() => {});

      // Fetch updated counts after marking
      setTimeout(() => get().fetchPlayerCounts(), 500);
    }
  },

  handleRealtimeUpdate: (latestGame: Game) => {
    const { currentGame } = get();
    if (!currentGame) return;

    // Use the server's version but preserve local admin token
    const updatedGame: Game = {
      ...latestGame,
      ...(currentGame.adminToken ? { adminToken: currentGame.adminToken } : {}),
    };

    set({
      currentGame: updatedGame,
    });
  },

  setConnectionStatus: (isConnected: boolean) => {
    set({ isConnected });
  },

  fetchPlayerCounts: async () => {
    const { currentGame } = get();
    if (!currentGame) return;

    try {
      const response = await fetch(
        `/api/game/${currentGame.gameCode}/player-counts`,
      );
      if (response.ok) {
        const data = await response.json();
        set({ allPlayerCounts: data.playerCounts || [] });
      } else {
        console.error(
          "Failed to fetch player counts, status:",
          response.status,
        );
      }
    } catch (error) {
      console.error("Failed to fetch player counts:", error);
    }
  },

  initialize: async () => {
    set({ isLoading: true });

    const games = await initializeGames();
    const localGames = games.map((game) => ({
      id: game.id,
      gameCode: game.gameCode,
      adminToken: game.adminToken,
      title: game.title,
    }));

    set({
      localGames,
      isLoading: false,
    });
  },
}));

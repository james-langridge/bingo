import { create } from "zustand";
import { produce } from "immer";
import type { WritableDraft } from "immer";
import type { Game, PlayerState, BingoItem } from "../types/types.ts";
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
import { checkForWinner, claimWin } from "./actions/winActions";
import {
  toggleItemMark,
  updateMarkedPositions,
} from "./calculations/itemCalculations";

interface GameStore {
  currentGame: Game | null;
  playerState: PlayerState | null;
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
  clearMarkedPositions: () => void;

  checkForWinner: () => Promise<void>;
  announceWin: () => Promise<void>;
  handleRealtimeUpdate: (game: Game) => void;
  setConnectionStatus: (isConnected: boolean) => void;

  initialize: () => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentGame: null,
  playerState: null,
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

      const syncManager = getSyncManager();
      syncManager.connect(gameCode, {
        onGameUpdate: (updatedGame) => get().handleRealtimeUpdate(updatedGame),
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
    const { currentGame, currentPlayerId, playerState } = get();
    if (!currentGame || !playerState || !currentPlayerId) return;

    if (playerState.hasWon || currentGame.winner) {
      return;
    }

    set(
      produce((draft: WritableDraft<GameStore>) => {
        if (!draft.playerState || !draft.currentGame) return;

        const marked = draft.playerState.markedPositions as number[];
        const isUnmarking = marked.includes(position);

        (draft.playerState.markedPositions as number[]) = updateMarkedPositions(
          marked,
          position,
          isUnmarking,
        ) as number[];
        (draft.playerState.lastSyncAt as number) = Date.now();

        const itemIndex = (draft.currentGame.items as BingoItem[]).findIndex(
          (item) => item.position === position,
        );

        if (itemIndex >= 0) {
          const item = draft.currentGame.items[itemIndex];
          (draft.currentGame.items as WritableDraft<BingoItem>[])[itemIndex] =
            toggleItemMark(
              item,
              currentPlayerId,
              playerState.displayName,
              isUnmarking,
            ) as WritableDraft<BingoItem>;
        }
      }),
    );

    const updatedState = get();
    if (updatedState.playerState && updatedState.currentGame) {
      Promise.all([
        persistPlayerState(updatedState.playerState),
        saveGameLocal(updatedState.currentGame),
      ]).catch(() => {});

      get().checkForWinner();
    }
  },

  clearMarkedPositions: () => {
    set(
      produce((draft: WritableDraft<GameStore>) => {
        if (!draft.playerState) return;
        draft.playerState.markedPositions = [];
        draft.playerState.lastSyncAt = Date.now();
      }),
    );

    const { playerState } = get();
    if (playerState) {
      persistPlayerState(playerState);
    }
  },

  checkForWinner: async () => {
    const { currentGame, playerState } = get();
    if (!currentGame || !playerState) return;

    const hasWon = await checkForWinner(currentGame, playerState);
    if (hasWon && !playerState.hasWon) {
      const updatedPlayerState: PlayerState = {
        ...playerState,
        hasWon: true,
      };
      await persistPlayerState(updatedPlayerState);
      await get().announceWin();
    }
  },

  announceWin: async () => {
    const { currentGame, playerState, currentPlayerId } = get();
    if (!currentGame || !playerState || !currentPlayerId) return;

    const result = await claimWin(currentGame, playerState, currentPlayerId);

    if (result.accepted) {
      set({
        currentGame: result.game,
        playerState: { ...playerState, hasWon: true },
      });
    } else {
      set({
        currentGame: result.game,
        playerState: { ...playerState, hasWon: false },
      });
    }
  },

  handleRealtimeUpdate: (latestGame: Game) => {
    const { currentGame, currentPlayerId, playerState } = get();
    if (!currentGame) return;

    // Preserve local markedBy data for items since it's client-side only
    const itemsWithPreservedMarks = latestGame.items.map((serverItem) => {
      const localItem = currentGame.items.find(
        (item) => item.id === serverItem.id,
      );
      if (localItem?.markedBy && localItem.markedBy.length > 0) {
        // Keep the local markedBy data
        return {
          ...serverItem,
          markedBy: localItem.markedBy,
        };
      }
      return serverItem;
    });

    // Use the server's version but preserve local client-side data
    const updatedGame: Game = {
      ...latestGame,
      items: itemsWithPreservedMarks,
      ...(currentGame.adminToken ? { adminToken: currentGame.adminToken } : {}),
    };

    set({
      currentGame: updatedGame,
    });

    // Check if we won
    if (
      latestGame.winner &&
      latestGame.winner.playerId === currentPlayerId &&
      playerState &&
      !playerState.hasWon
    ) {
      set(
        produce((draft: WritableDraft<GameStore>) => {
          if (draft.playerState) {
            draft.playerState.hasWon = true;
          }
        }),
      );
    }
  },

  setConnectionStatus: (isConnected: boolean) => {
    set({ isConnected });
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

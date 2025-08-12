import { create } from "zustand";
import { produce } from "immer";
import type { WritableDraft } from "immer";
import type { Game, PlayerState, BingoItem } from "../types/types.ts";
import {
  loadPlayerState,
  saveGameLocal,
} from "../lib/storage";
import {
  getSyncManager,
  resetSyncManager,
  mergeGameStates,
} from "../lib/syncManager";
import { TIMEOUTS } from "../lib/constants";

import {
  createGame,
  loadGame,
  saveGameItems,
  deleteGame,
  initializeGames,
} from "./actions/gameActions";
import {
  joinGame as joinGameAction,
  updatePlayerActivity as updateActivity,
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
  pollingInterval: number | null;
  currentPlayerId: string | null;
  isConnected: boolean;
  optimisticState: PlayerState | null;
  lastServerState: Game | null;
  optimisticWinClaim: boolean;
  nearMissInfo: {
    winnerName: string;
    timeDifference: number;
    showNotification: boolean;
  } | null;

  createGame: (title: string) => Promise<Game>;
  loadGame: (gameCode: string) => Promise<void>;
  loadGameAsAdmin: (gameCode: string, adminToken: string) => Promise<void>;
  updateGameItems: (items: BingoItem[]) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;

  joinGame: (gameCode: string, displayName: string) => Promise<void>;
  markPosition: (position: number) => void;
  clearMarkedPositions: () => void;

  updatePlayerActivity: () => Promise<void>;
  checkForWinner: () => Promise<void>;
  announceWin: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  refreshGameState: () => Promise<void>;
  handleRealtimeUpdate: (game: Game) => void;
  setConnectionStatus: (isConnected: boolean) => void;

  initialize: () => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentGame: null,
  playerState: null,
  localGames: [],
  isLoading: false,
  pollingInterval: null,
  currentPlayerId: null,
  isConnected: false,
  optimisticState: null,
  lastServerState: null,
  optimisticWinClaim: false,
  nearMissInfo: null,

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
      })
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
          lastServerState: null,
          isLoading: false,
        });
        return;
      }

      let playerId = null;
      if (playerState) {
        const existingPlayer = game.players.find(
          (p) => p.displayName === playerState.displayName
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
        lastServerState: game,
        isLoading: false,
      });

      const syncManager = getSyncManager({
        onGameUpdate: (updatedGame) => get().handleRealtimeUpdate(updatedGame),
        onConnectionChange: (isConnected) =>
          get().setConnectionStatus(isConnected),
        onWinnerAnnounced: () => {},
      });
      syncManager.connect(gameCode);

      if (playerState) {
        get().startPolling();
      }
    } catch (error) {
      set({
        currentGame: null,
        playerState: null,
        lastServerState: null,
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
          (g) => g.id === updatedGame.id
        );
        if (gameIndex >= 0) {
          draft.localGames[gameIndex] = {
            id: updatedGame.id,
            gameCode: updatedGame.gameCode,
            adminToken: updatedGame.adminToken,
            title: updatedGame.title,
          };
        }
      })
    );

    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.markActivity(true);
    }
  },

  deleteGame: async (gameId) => {
    await deleteGame(gameId);

    set(
      produce((draft: WritableDraft<GameStore>) => {
        draft.localGames = draft.localGames.filter(
          (g) => g.id !== gameId
        );
        if (draft.currentGame?.id === gameId) {
          draft.currentGame = null;
        }
      })
    );
  },

  joinGame: async (gameCode, displayName) => {
    const { game, playerState, playerId } = await joinGameAction(
      gameCode,
      displayName
    );

    set({
      currentGame: game,
      playerState,
      currentPlayerId: playerId,
      lastServerState: game,
    });

    const syncManager = getSyncManager({
      onGameUpdate: (updatedGame) => get().handleRealtimeUpdate(updatedGame),
      onConnectionChange: (isConnected) =>
        get().setConnectionStatus(isConnected),
      onWinnerAnnounced: () => {},
    });
    syncManager.connect(gameCode);

    get().startPolling();
  },

  markPosition: (position) => {
    const { currentGame, currentPlayerId, playerState } = get();
    if (!currentGame || !playerState || !currentPlayerId) return;

    if (playerState.hasWon || currentGame.winner) {
      return;
    }

    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.markActivity(true);
    }

    set(
      produce((draft: WritableDraft<GameStore>) => {
        if (!draft.playerState || !draft.currentGame) return;

        draft.optimisticState = { ...draft.playerState };

        const marked = draft.playerState.markedPositions as number[];
        const isUnmarking = marked.includes(position);

        (draft.playerState.markedPositions as number[]) = updateMarkedPositions(
          marked,
          position,
          isUnmarking
        ) as number[];
        (draft.playerState.lastSyncAt as number) = Date.now();

        const itemIndex = (draft.currentGame.items as BingoItem[]).findIndex(
          (item) => item.position === position
        );

        if (itemIndex >= 0) {
          const item = draft.currentGame.items[itemIndex];
          (draft.currentGame.items as WritableDraft<BingoItem>[])[itemIndex] = toggleItemMark(
            item,
            currentPlayerId,
            playerState.displayName,
            isUnmarking
          ) as WritableDraft<BingoItem>;
        }
      })
    );

    const updatedState = get();
    if (updatedState.playerState && updatedState.currentGame) {
      Promise.all([
        persistPlayerState(updatedState.playerState),
        saveGameLocal(updatedState.currentGame),
      ]).catch(() => {
        set(
          produce((draft: WritableDraft<GameStore>) => {
            if (draft.optimisticState) {
              draft.playerState = draft.optimisticState;
              draft.optimisticState = null;
            }
          })
        );
      });

      get().checkForWinner();
    }
  },

  clearMarkedPositions: () => {
    set(
      produce((draft: WritableDraft<GameStore>) => {
        if (!draft.playerState) return;
        draft.playerState.markedPositions = [];
        draft.playerState.lastSyncAt = Date.now();
      })
    );

    const { playerState } = get();
    if (playerState) {
      persistPlayerState(playerState);
    }
  },

  updatePlayerActivity: async () => {
    const { currentGame, currentPlayerId } = get();
    if (!currentGame || !currentPlayerId) return;

    await updateActivity(currentGame, currentPlayerId);
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

    set({ optimisticWinClaim: true });

    const result = await claimWin(currentGame, playerState, currentPlayerId);

    if (result.accepted) {
      set({
        currentGame: result.game,
        lastServerState: result.game,
        playerState: { ...playerState, hasWon: true },
        optimisticWinClaim: false,
        nearMissInfo: null,
      });
    } else {
      set({
        currentGame: result.game,
        lastServerState: result.game,
        playerState: { ...playerState, hasWon: false },
        optimisticWinClaim: false,
      });

      if (result.nearMiss) {
        set(
          produce((draft: WritableDraft<GameStore>) => {
            if (result.nearMiss) {
              draft.nearMissInfo = {
                winnerName: result.nearMiss.winnerName || '',
                timeDifference: result.nearMiss.timeDifference || 0,
                showNotification: true,
              };
            }
          })
        );
      }
    }
  },

  startPolling: () => {
    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.pollNow();
    }

    const { pollingInterval } = get();
    if (pollingInterval) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        get().updatePlayerActivity();
      }
    }, TIMEOUTS.ACTIVITY_CHECK);

    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }

    resetSyncManager();
  },

  refreshGameState: async () => {
    const { currentGame } = get();
    if (!currentGame) return;

    try {
      const latestGame = await loadGame(currentGame.gameCode);

      if (latestGame) {
        get().handleRealtimeUpdate(latestGame);
      }
    } catch (error) {}
  },

  handleRealtimeUpdate: (latestGame: Game) => {
    const { currentGame, currentPlayerId, playerState } = get();
    if (!currentGame) return;

    let gameToMerge: Game;

    if (latestGame.settings) {
      gameToMerge = latestGame;
    } else {
      if (latestGame.items) {
        const maxLength = Math.max(
          latestGame.items.length,
          currentGame.items?.length || 0
        );

        const mergedItems = [];
        for (let i = 0; i < maxLength; i++) {
          const currentItem = currentGame.items?.[i];
          const updatedItem = latestGame.items[i];

          if (updatedItem) {
            if (currentItem) {
              mergedItems.push({
                ...currentItem,
                ...updatedItem,
                text: updatedItem.text || currentItem.text,
              });
            } else {
              mergedItems.push(updatedItem);
            }
          } else if (currentItem) {
            mergedItems.push(currentItem);
          }
        }
        gameToMerge = { ...currentGame, ...latestGame, items: mergedItems };
      } else {
        gameToMerge = { ...currentGame, ...latestGame };
      }
    }

    const mergedGame = mergeGameStates(currentGame, gameToMerge);

    if (mergedGame.winner && !currentGame.winner) {
      if (mergedGame.winner.playerId === currentPlayerId) {
        set(
          produce((draft: WritableDraft<GameStore>) => {
            draft.nearMissInfo = null;
          })
        );
      } else {
        if (
          playerState &&
          currentGame.items &&
          playerState.markedPositions.length === currentGame.items.length
        ) {
          const timeDiff = Date.now() - mergedGame.winner.wonAt;
          if (timeDiff < TIMEOUTS.NEAR_MISS_WINDOW) {
            set(
              produce((draft: WritableDraft<GameStore>) => {
                draft.nearMissInfo = {
                  winnerName: mergedGame.winner!.displayName,
                  timeDifference: timeDiff,
                  showNotification: true,
                };
              })
            );
          }
        }
      }
    }

    const currentPlayerCount = currentGame.players?.length || 0;
    const latestPlayerCount = mergedGame.players?.length || 0;
    if (latestPlayerCount > currentPlayerCount) {
    }

    const now = Date.now();

    const updatedPlayers = mergedGame.players.map((p) => ({
      ...p,
      isOnline:
        p.id === currentPlayerId
          ? true
          : now - (p.lastSeenAt || 0) < TIMEOUTS.ONLINE_THRESHOLD,
    }));

    const updatedGame: Game = {
      ...mergedGame,
      players: updatedPlayers,
      ...(currentGame.adminToken ? { adminToken: currentGame.adminToken } : {}),
    };

    set({
      currentGame: updatedGame,
      lastServerState: updatedGame,
    });

    if (
      mergedGame.winner &&
      mergedGame.winner.playerId === currentPlayerId &&
      playerState &&
      !playerState.hasWon
    ) {
      set(
        produce((draft: WritableDraft<GameStore>) => {
          if (draft.playerState) {
            draft.playerState.hasWon = true;
          }
        })
      );
    }
  },

  setConnectionStatus: (isConnected: boolean) => {
    const previouslyConnected = get().isConnected;
    set({ isConnected });

    if (!previouslyConnected && isConnected) {
      const { optimisticWinClaim, playerState } = get();
      if (optimisticWinClaim && playerState?.hasWon) {
        get().announceWin();
      }
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
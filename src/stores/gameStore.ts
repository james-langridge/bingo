import { create } from "zustand";
import { produce } from "immer";
import type {
  Game,
  PlayerState,
  BingoItem,
  Player,
  WinnerInfo,
} from "../types/types.ts";
import {
  generateGameCode,
  generateAdminToken,
  checkWinCondition,
} from "../lib/calculations";
import {
  saveGameLocal,
  loadLocalGames,
  loadGameByCode,
  deleteGameLocal,
  savePlayerState,
  loadPlayerState,
} from "../lib/storage";

interface GameStore {
  // Immutable state
  currentGame: Game | null;
  playerState: PlayerState | null;
  localGames: readonly {
    id: string;
    gameCode: string;
    adminToken?: string;
    title: string;
  }[];
  isLoading: boolean;
  pollingInterval: number | null;
  currentPlayerId: string | null;

  // Actions (thin layer over calculations)
  createGame: (title: string) => Promise<Game>;
  loadGame: (gameCode: string) => Promise<void>;
  loadGameAsAdmin: (gameCode: string, adminToken: string) => Promise<void>;
  updateGameItems: (items: BingoItem[]) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;

  // Player actions
  joinGame: (gameCode: string, displayName: string) => Promise<void>;
  markPosition: (position: number) => void;
  clearMarkedPositions: () => void;

  // Multiplayer actions
  updatePlayerActivity: () => Promise<void>;
  checkForWinner: () => Promise<void>;
  announceWin: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  refreshGameState: () => Promise<void>;

  // Initialize store
  initialize: () => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentGame: null,
  playerState: null,
  localGames: [],
  isLoading: false,
  pollingInterval: null,
  currentPlayerId: null,

  createGame: async (title) => {
    const game: Game = {
      id: crypto.randomUUID(),
      adminToken: generateAdminToken(),
      gameCode: generateGameCode(),
      title,
      items: [],
      settings: { gridSize: 5, requireFullCard: false, freeSpace: true },
      createdAt: Date.now(),
      lastModifiedAt: Date.now(),
      players: [], // Initialize empty players array
    };

    await saveGameLocal(game);

    set(
      produce((draft) => {
        draft.currentGame = game;
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

    const game = await loadGameByCode(gameCode);
    const playerState = await loadPlayerState(gameCode);

    set({
      currentGame: game || null,
      playerState: playerState || null,
      isLoading: false,
    });

    // Start polling if we're in a game
    if (game && playerState) {
      get().startPolling();
    }
  },

  loadGameAsAdmin: async (gameCode, adminToken) => {
    set({ isLoading: true });

    const game = await loadGameByCode(gameCode);

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

    const updatedGame: Game = {
      ...currentGame,
      items,
      lastModifiedAt: Date.now(),
    };

    await saveGameLocal(updatedGame);

    set(
      produce((draft) => {
        draft.currentGame = updatedGame;
        const gameIndex = draft.localGames.findIndex(
          (g: any) => g.id === updatedGame.id,
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
    await deleteGameLocal(gameId);

    set(
      produce((draft) => {
        draft.localGames = draft.localGames.filter((g: any) => g.id !== gameId);
        if (draft.currentGame?.id === gameId) {
          draft.currentGame = null;
        }
      }),
    );
  },

  joinGame: async (gameCode, displayName) => {
    const game = await loadGameByCode(gameCode);
    if (!game) throw new Error("Game not found");

    // Generate a unique player ID for this session
    const playerId = crypto.randomUUID();
    set({ currentPlayerId: playerId });

    // Check if player with same name already exists (returning player)
    const existingPlayer = game.players.find(
      (p) => p.displayName === displayName,
    );

    let updatedPlayers;
    if (existingPlayer) {
      // Update existing player's info (they're back!)
      updatedPlayers = game.players.map((p) =>
        p.displayName === displayName
          ? { ...p, id: playerId, lastSeenAt: Date.now(), isOnline: true }
          : p,
      );
    } else {
      // New player joining for the first time
      const newPlayer: Player = {
        id: playerId,
        displayName,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        hasWon: false,
        isOnline: true,
      };
      updatedPlayers = [...game.players, newPlayer];
    }

    const updatedGame: Game = {
      ...game,
      players: updatedPlayers,
      lastModifiedAt: Date.now(),
    };

    // Save updated game with new/returning player
    await saveGameLocal(updatedGame);

    // Create or restore player state
    let playerState = await loadPlayerState(gameCode);
    if (!playerState || playerState.displayName !== displayName) {
      playerState = {
        gameCode,
        displayName,
        markedPositions: [],
        lastSyncAt: Date.now(),
        hasWon: existingPlayer?.hasWon || false,
      };
      await savePlayerState(playerState);
    }

    set({
      currentGame: updatedGame,
      playerState,
    });

    // Start polling for updates
    get().startPolling();
  },

  markPosition: (position) => {
    set(
      produce((draft) => {
        if (!draft.playerState) return;

        const marked = draft.playerState.markedPositions;
        if (marked.includes(position)) {
          draft.playerState.markedPositions = marked.filter(
            (pos: number) => pos !== position,
          );
        } else {
          draft.playerState.markedPositions = [...marked, position];
        }

        draft.playerState.lastSyncAt = Date.now();
      }),
    );

    // Save updated player state
    const { playerState } = get();
    if (playerState) {
      savePlayerState(playerState);
      // Check if player has won after marking
      get().checkForWinner();
    }
  },

  clearMarkedPositions: () => {
    set(
      produce((draft) => {
        if (!draft.playerState) return;
        draft.playerState.markedPositions = [];
        draft.playerState.lastSyncAt = Date.now();
      }),
    );

    // Save updated player state
    const { playerState } = get();
    if (playerState) {
      savePlayerState(playerState);
    }
  },

  // Update player's last seen time
  updatePlayerActivity: async () => {
    const { currentGame, playerState, currentPlayerId } = get();
    if (!currentGame || !playerState || !currentPlayerId) return;

    const updatedPlayers = currentGame.players.map((p) =>
      p.id === currentPlayerId
        ? { ...p, lastSeenAt: Date.now(), isOnline: true }
        : p,
    );

    const updatedGame: Game = {
      ...currentGame,
      players: updatedPlayers,
      lastModifiedAt: Date.now(),
    };

    await saveGameLocal(updatedGame);
    set({ currentGame: updatedGame });
  },

  // Check if current player has won
  checkForWinner: async () => {
    const { currentGame, playerState } = get();
    if (!currentGame || !playerState || playerState.hasWon) return;

    const hasWon = checkWinCondition(
      playerState.markedPositions,
      currentGame.settings.gridSize,
      currentGame.settings.requireFullCard,
    );

    if (hasWon) {
      // Update player state
      const updatedPlayerState: PlayerState = {
        ...playerState,
        hasWon: true,
      };
      await savePlayerState(updatedPlayerState);

      // Announce the win
      await get().announceWin();
    }
  },

  // Announce that current player has won
  announceWin: async () => {
    const { currentGame, playerState, currentPlayerId } = get();
    if (!currentGame || !playerState || !currentPlayerId) return;

    const winner: WinnerInfo = {
      playerId: currentPlayerId,
      displayName: playerState.displayName,
      wonAt: Date.now(),
      winType: currentGame.settings.requireFullCard ? "fullCard" : "line",
    };

    // Update player's hasWon status in players list
    const updatedPlayers = currentGame.players.map((p) =>
      p.id === currentPlayerId
        ? { ...p, hasWon: true, lastSeenAt: Date.now() }
        : p,
    );

    const updatedGame: Game = {
      ...currentGame,
      players: updatedPlayers,
      winner,
      lastModifiedAt: Date.now(),
    };

    await saveGameLocal(updatedGame);
    set({
      currentGame: updatedGame,
      playerState: { ...playerState, hasWon: true },
    });
  },

  // Start polling for game updates
  startPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) return; // Already polling

    // Poll every 2 seconds for updates (faster for better UX)
    const interval = window.setInterval(() => {
      get().refreshGameState();
      get().updatePlayerActivity();
    }, 2000);

    set({ pollingInterval: interval });
  },

  // Stop polling
  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },

  // Refresh game state to get latest updates from Redis
  refreshGameState: async () => {
    const { currentGame, currentPlayerId } = get();
    if (!currentGame) return;

    try {
      // Fetch latest game state from server/Redis
      const latestGame = await loadGameByCode(currentGame.gameCode);

      if (
        latestGame &&
        latestGame.lastModifiedAt > currentGame.lastModifiedAt
      ) {
        // Mark currently active players (optional enhancement)
        const now = Date.now();
        const onlineThreshold = 10000; // Consider "online" if seen in last 10 seconds

        const updatedPlayers = latestGame.players.map((p) => ({
          ...p,
          isOnline:
            p.id === currentPlayerId
              ? true
              : now - (p.lastSeenAt || 0) < onlineThreshold,
        }));

        const updatedGame: Game = {
          ...latestGame,
          players: updatedPlayers,
        };

        set({ currentGame: updatedGame });
      }
    } catch (error) {
      console.error("[GameStore] Failed to refresh game state:", error);
    }
  },

  initialize: async () => {
    set({ isLoading: true });

    const games = await loadLocalGames();
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

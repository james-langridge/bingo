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
import {
  getSyncManager,
  resetSyncManager,
  mergeGameStates,
} from "../lib/syncManager";

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
  isConnected: boolean;
  optimisticState: PlayerState | null; // For optimistic updates
  lastServerState: Game | null; // For rollback

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
  handleRealtimeUpdate: (game: Game) => void;
  setConnectionStatus: (isConnected: boolean) => void;

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
  isConnected: false,
  optimisticState: null,
  lastServerState: null,

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
      lastServerState: game || null,
      isLoading: false,
    });

    // Connect to real-time updates if we're in a game
    if (game) {
      const syncManager = getSyncManager({
        onGameUpdate: (updatedGame) => get().handleRealtimeUpdate(updatedGame),
        onConnectionChange: (isConnected) => get().setConnectionStatus(isConnected),
        onWinnerAnnounced: (winnerName) => {
          console.log(`[GameStore] Winner announced: ${winnerName}`);
        },
      });
      syncManager.connect(gameCode);
    }

    // Keep polling as fallback
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
    // Always fetch the latest game state from server first
    const game = await loadGameByCode(gameCode);
    if (!game) throw new Error("Game not found");

    // Generate a unique player ID for this session
    const playerId = crypto.randomUUID();
    set({ currentPlayerId: playerId });

    // Use a more robust player identification
    // Players are unique by displayName within a game
    const existingPlayerIndex = game.players.findIndex(
      (p) => p.displayName === displayName,
    );

    let updatedPlayers = [...game.players];
    if (existingPlayerIndex >= 0) {
      // Update existing player's info (they're back!)
      updatedPlayers[existingPlayerIndex] = {
        ...updatedPlayers[existingPlayerIndex],
        id: playerId,
        lastSeenAt: Date.now(),
        isOnline: true,
      };
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
      updatedPlayers.push(newPlayer);
    }

    const updatedGame: Game = {
      ...game,
      players: updatedPlayers,
      lastModifiedAt: Date.now(),
    };

    // Save updated game with new/returning player - this will sync to Redis
    await saveGameLocal(updatedGame);

    // Force immediate sync to server
    if (navigator.onLine) {
      try {
        const response = await fetch(`/api/game/${gameCode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedGame),
        });
        if (response.ok) {
          console.log("[GameStore] Player join synced to server immediately");
        }
      } catch (error) {
        console.error("[GameStore] Failed to sync player join:", error);
      }
    }

    // Create or restore player state
    let playerState = await loadPlayerState(gameCode);
    if (!playerState || playerState.displayName !== displayName) {
      playerState = {
        gameCode,
        displayName,
        markedPositions: [],
        lastSyncAt: Date.now(),
        hasWon: existingPlayerIndex >= 0 ? updatedPlayers[existingPlayerIndex].hasWon : false,
      };
      await savePlayerState(playerState);
    }

    set({
      currentGame: updatedGame,
      playerState,
      lastServerState: updatedGame,
    });

    // Connect to real-time updates
    const syncManager = getSyncManager({
      onGameUpdate: (updatedGame) => get().handleRealtimeUpdate(updatedGame),
      onConnectionChange: (isConnected) => get().setConnectionStatus(isConnected),
      onWinnerAnnounced: (winnerName) => {
        console.log(`[GameStore] Winner announced: ${winnerName}`);
      },
    });
    syncManager.connect(gameCode);

    // Start polling as fallback
    get().startPolling();
  },

  markPosition: (position) => {
    // Optimistic update
    set(
      produce((draft) => {
        if (!draft.playerState) return;

        // Save current state for potential rollback
        draft.optimisticState = { ...draft.playerState };

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
      savePlayerState(playerState).catch((error) => {
        console.error("[GameStore] Failed to save player state:", error);
        // Rollback on failure
        set(
          produce((draft) => {
            if (draft.optimisticState) {
              draft.playerState = draft.optimisticState;
              draft.optimisticState = null;
            }
          }),
        );
      });
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

    // Only update if player exists in the list
    const playerExists = currentGame.players.some(p => p.id === currentPlayerId);
    if (!playerExists) {
      console.log("[GameStore] Player not in list, skipping activity update");
      return;
    }

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

    // Save locally - this will also sync to server in background
    await saveGameLocal(updatedGame);
    
    // Don't update local state here to avoid conflicts with refreshGameState
    // The next refresh will pull the updated state
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

    console.log("[Multiplayer] Checking for win:", {
      hasWon,
      markedPositions: playerState.markedPositions,
      gridSize: currentGame.settings.gridSize,
      requireFullCard: currentGame.settings.requireFullCard,
    });

    if (hasWon) {
      console.log("[Multiplayer] Player has won! Announcing win...");
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

    console.log("[Multiplayer] Announcing win:", winner);

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

    // Save locally first
    await saveGameLocal(updatedGame);
    console.log("[Multiplayer] Game updated with winner, syncing to Redis...");

    // Force immediate sync to server so other players see the winner
    if (navigator.onLine) {
      try {
        const response = await fetch(`/api/game/${currentGame.gameCode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedGame),
        });
        if (response.ok) {
          console.log("[Multiplayer] Winner announcement synced to server!");
        }
      } catch (error) {
        console.error("[Multiplayer] Failed to sync winner announcement:", error);
      }
    }

    set({
      currentGame: updatedGame,
      playerState: { ...playerState, hasWon: true },
    });
  },

  // Start polling for game updates (fallback for SSE)
  startPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) return; // Already polling

    // Poll every 5 seconds as fallback (SSE handles real-time)
    const interval = window.setInterval(() => {
      // Only poll if not connected to SSE
      if (!get().isConnected) {
        get().refreshGameState();
      }
      get().updatePlayerActivity();
    }, 5000);

    set({ pollingInterval: interval });
  },

  // Stop polling and disconnect SSE
  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
    // Disconnect SSE
    resetSyncManager();
  },

  // Refresh game state to get latest updates from Redis
  refreshGameState: async () => {
    const { currentGame } = get();
    if (!currentGame) return;

    try {
      // Fetch latest game state from server/Redis
      const latestGame = await loadGameByCode(currentGame.gameCode);

      if (latestGame) {
        get().handleRealtimeUpdate(latestGame);
      }
    } catch (error) {
      console.error("[GameStore] Failed to refresh game state:", error);
    }
  },

  // Handle real-time updates from SSE or polling
  handleRealtimeUpdate: (latestGame: Game) => {
    const { currentGame, currentPlayerId, playerState } = get();
    if (!currentGame) return;

    // Use proper state merging to prevent overwrites
    const mergedGame = mergeGameStates(currentGame, latestGame);

    // Check if there's a new winner
    if (mergedGame.winner && !currentGame.winner) {
      console.log("[Multiplayer] New winner detected:", mergedGame.winner);
      // If someone else won, update our player state
      if (mergedGame.winner.displayName !== playerState?.displayName) {
        console.log("[Multiplayer] Another player has won the game!");
      }
    }

    // Check if new players joined
    const currentPlayerCount = currentGame.players?.length || 0;
    const latestPlayerCount = mergedGame.players?.length || 0;
    if (latestPlayerCount > currentPlayerCount) {
      console.log(`[Multiplayer] New players joined! (${currentPlayerCount} -> ${latestPlayerCount})`);
    }

    // Mark currently active players
    const now = Date.now();
    const onlineThreshold = 15000; // Consider "online" if seen in last 15 seconds

    const updatedPlayers = mergedGame.players.map((p) => ({
      ...p,
      isOnline:
        p.id === currentPlayerId
          ? true
          : now - (p.lastSeenAt || 0) < onlineThreshold,
    }));

    // Create updated game with preserved admin token if it exists
    const updatedGame: Game = {
      ...mergedGame,
      players: updatedPlayers,
      ...(currentGame.adminToken ? { adminToken: currentGame.adminToken } : {}),
    };

    // Update the entire game state including winner and players list
    set({ 
      currentGame: updatedGame,
      lastServerState: updatedGame,
    });

    // If we detect a winner and it's us, update our player state
    if (mergedGame.winner && 
        mergedGame.winner.displayName === playerState?.displayName && 
        !playerState.hasWon) {
      set(produce(draft => {
        if (draft.playerState) {
          draft.playerState.hasWon = true;
        }
      }));
    }
  },

  // Set connection status
  setConnectionStatus: (isConnected: boolean) => {
    set({ isConnected });
    console.log(`[GameStore] Connection status: ${isConnected ? "Connected" : "Disconnected"}`);
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

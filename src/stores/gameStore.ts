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
import { TIMEOUTS } from "../lib/constants";

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
  optimisticWinClaim: boolean; // Track if we're claiming a win optimistically
  nearMissInfo: {
    winnerName: string;
    timeDifference: number;
    showNotification: boolean;
  } | null; // For near miss notifications

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
  optimisticWinClaim: false,
  nearMissInfo: null,

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

    try {
      const game = await loadGameByCode(gameCode);
      const playerState = await loadPlayerState(gameCode);

      // Only proceed if game exists
      if (!game) {
        set({
          currentGame: null,
          playerState: null,
          lastServerState: null,
          isLoading: false,
        });
        return;
      }

      // If we have a playerState, restore the currentPlayerId
      // Find the player in the game's players list by matching display name
      let playerId = null;
      if (playerState) {
        const existingPlayer = game.players.find(
          p => p.displayName === playerState.displayName
        );
        if (existingPlayer) {
          playerId = existingPlayer.id;
        } else {
          // If player not found in list, generate new ID
          // This handles edge cases where player state exists but player was removed
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

      // Connect to real-time updates if we're in a game
      const syncManager = getSyncManager({
        onGameUpdate: (updatedGame) => get().handleRealtimeUpdate(updatedGame),
        onConnectionChange: (isConnected) => get().setConnectionStatus(isConnected),
        onWinnerAnnounced: () => {},
      });
      syncManager.connect(gameCode);

      // Keep polling as fallback
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

    // Save locally first
    await saveGameLocal(updatedGame);

    // Update local state immediately for optimistic update
    set(
      produce((draft: any) => {
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

    // Sync to server if online (this was missing!)
    if (navigator.onLine && currentGame.adminToken) {
      try {
        const response = await fetch(`/api/game/${currentGame.gameCode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedGame),
        });
        
        if (!response.ok) {
        } else {
          
          // Trigger immediate poll for other players to get the update
          const syncManager = getSyncManager();
          if (syncManager) {
            syncManager.markActivity(true);
          }
        }
      } catch (error) {
      }
    }
  },

  deleteGame: async (gameId) => {
    await deleteGameLocal(gameId);

    set(
      produce((draft: any) => {
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
        }
      } catch (error) {
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
      onWinnerAnnounced: () => {},
    });
    syncManager.connect(gameCode);

    // Start polling as fallback
    get().startPolling();
  },

  markPosition: (position) => {
    const { currentGame, currentPlayerId, playerState } = get();
    if (!currentGame || !playerState || !currentPlayerId) return;

    // Check if player has won - if so, don't allow more marking
    if (playerState.hasWon || currentGame.winner) {
      return;
    }

    // Mark activity for immediate polling
    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.markActivity(true);
    }

    // Optimistic update for both player state and game items
    set(
      produce((draft: any) => {
        if (!draft.playerState || !draft.currentGame) return;

        // Save current state for potential rollback
        draft.optimisticState = { ...draft.playerState };

        // Update player's marked positions
        const marked = draft.playerState.markedPositions;
        const isUnmarking = marked.includes(position);
        
        if (isUnmarking) {
          draft.playerState.markedPositions = marked.filter(
            (pos: number) => pos !== position,
          );
        } else {
          draft.playerState.markedPositions = [...marked, position];
        }

        draft.playerState.lastSyncAt = Date.now();

        // Update the item's markedBy array (vacation mode: multiple people can mark)
        // Find the item by its position property, not array index!
        const itemIndex = draft.currentGame.items.findIndex(
          (item: any) => item.position === position
        );
        
        if (itemIndex >= 0) {
          const item = draft.currentGame.items[itemIndex];
          const markedBy = item.markedBy || [];
          const existingMarkIndex = markedBy.findIndex(
            (mark: any) => mark.playerId === currentPlayerId
          );

          if (isUnmarking && existingMarkIndex >= 0) {
            // Remove this player's mark
            draft.currentGame.items[itemIndex] = {
              ...item,
              markedBy: markedBy.filter((_: any, i: number) => i !== existingMarkIndex),
            };
          } else if (!isUnmarking && existingMarkIndex < 0) {
            // Add this player's mark
            const newMark = {
              playerId: currentPlayerId,
              displayName: playerState.displayName,
              markedAt: Date.now(),
            };
            draft.currentGame.items[itemIndex] = {
              ...item,
              markedBy: [...markedBy, newMark],
            };
          }
        }
      }),
    );

    // Save updated state
    const updatedState = get();
    if (updatedState.playerState && updatedState.currentGame) {
      // Save both player state and game state
      Promise.all([
        savePlayerState(updatedState.playerState),
        saveGameLocal(updatedState.currentGame),
      ]).catch(() => {
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
      
      // The sync is now handled by markActivity above
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

    // Mark activity for polling interval adjustment
    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.markActivity(false);
    }

    // Only update if player exists in the list
    const playerExists = currentGame.players.some(p => p.id === currentPlayerId);
    if (!playerExists) {
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
    if (!currentGame || !playerState) return;
    
    // If player already marked as won, skip check
    if (playerState.hasWon) {
      return;
    }
    
    // If game already has a winner and it's not us, don't check
    if (currentGame.winner && currentGame.winner.displayName !== playerState.displayName) {
      return;
    }

    // Use actual number of items, not grid size squared
    const totalItems = currentGame.items.length;
    const hasWon = playerState.markedPositions.length === totalItems;


    if (hasWon) {
      
      // Check if we already won (e.g., after page refresh)
      if (currentGame.winner?.displayName === playerState.displayName) {
        // Just update local state
        const updatedPlayerState: PlayerState = {
          ...playerState,
          hasWon: true,
        };
        await savePlayerState(updatedPlayerState);
        set({ playerState: updatedPlayerState });
        return;
      }
      
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

  // Announce that current player has won with atomic check
  announceWin: async () => {
    const { currentGame, playerState, currentPlayerId } = get();
    if (!currentGame || !playerState || !currentPlayerId) return;


    // Trigger immediate poll after win announcement
    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.markActivity(true);
    }

    // Step 1: Fetch absolute latest game state from server before declaring victory
    let latestGame: Game | null = null;
    if (navigator.onLine) {
      try {
        const response = await fetch(`/api/game/${currentGame.gameCode}`);
        if (response.ok) {
          latestGame = await response.json();
        }
      } catch (error) {
      }
    }

    // Step 2: Check if someone already won
    if (latestGame?.winner) {
      
      // Check if WE are the winner (this can happen if we already won but are retrying)
      if (latestGame.winner.playerId === currentPlayerId) {
        // Update local state to confirm we won
        set({
          currentGame: latestGame,
          lastServerState: latestGame,
          playerState: { ...playerState, hasWon: true },
          nearMissInfo: null, // Clear any near-miss notification since we're the winner
        });
        return; // We already won, no need to claim again
      }
      
      // Someone else won - update state and show near miss if applicable
      set({
        currentGame: latestGame,
        lastServerState: latestGame,
      });

      // Check if it was a near miss
      const timeDiff = Date.now() - latestGame.winner.wonAt;
      if (timeDiff < TIMEOUTS.NEAR_MISS_WINDOW) {
        // Trigger near miss notification for the player who didn't win
        set(produce(draft => {
          draft.nearMissInfo = {
            winnerName: latestGame.winner!.displayName,
            timeDifference: timeDiff,
            showNotification: true,
          };
        }));
      }
      return; // Someone else already won
    }

    // Step 3: Prepare winner info with winning positions for verification
    const winningPositions = playerState.markedPositions;
    const winner: WinnerInfo & { winningPositions?: readonly number[] } = {
      playerId: currentPlayerId,
      displayName: playerState.displayName,
      wonAt: Date.now(), // Will be replaced by server timestamp
      winType: currentGame.settings.requireFullCard ? "fullCard" : "line",
      winningPositions, // For audit/verification
    };


    // Step 4: Show optimistic UI immediately
    const optimisticGame: Game = {
      ...currentGame,
      players: currentGame.players.map((p) =>
        p.id === currentPlayerId
          ? { ...p, hasWon: true, lastSeenAt: Date.now() }
          : p,
      ),
      winner,
      lastModifiedAt: Date.now(),
    };

    // Save optimistically locally
    await saveGameLocal(optimisticGame);
    set({
      currentGame: optimisticGame,
      playerState: { ...playerState, hasWon: true },
      optimisticWinClaim: true, // Track that we're claiming a win
    });

    // Step 5: Try to claim victory on server with atomic check
    if (navigator.onLine) {
      try {
        const response = await fetch(`/api/game/${currentGame.gameCode}/claim-win`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: currentPlayerId,
            displayName: playerState.displayName,
            winType: winner.winType,
            winningPositions: winner.winningPositions,
            clientTimestamp: Date.now(),
          }),
        });

        const result = await response.json();

        if (response.ok && result.accepted) {
          // Update with server-confirmed winner info
          const confirmedGame = result.game;
          set({
            currentGame: confirmedGame,
            lastServerState: confirmedGame,
            optimisticWinClaim: false,
            nearMissInfo: null, // Clear any near-miss notification since we won
          });
        } else if (result.actualWinner) {
          
          // Rollback optimistic update
          const actualGame = result.game;
          set({
            currentGame: actualGame,
            lastServerState: actualGame,
            playerState: { ...playerState, hasWon: false }, // We didn't actually win
            optimisticWinClaim: false,
          });

          // Check for near miss
          const timeDiff = Math.abs(Date.now() - result.actualWinner.wonAt);
          if (timeDiff < TIMEOUTS.NEAR_MISS_WINDOW) {
            set(produce(draft => {
              draft.nearMissInfo = {
                winnerName: result.actualWinner.displayName,
                timeDifference: timeDiff,
                showNotification: true,
              };
            }));
          }
        }
      } catch (error) {
        // Keep optimistic update but mark as unconfirmed
        set({ optimisticWinClaim: false });
      }
    } else {
      // Offline - keep optimistic update, will verify when back online
    }
  },

  // Start polling for game updates
  startPolling: () => {
    // Polling is now handled by SyncManager with smart intervals
    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.pollNow();
    }

    // Still maintain activity updates for vacation mode
    const { pollingInterval } = get();
    if (pollingInterval) return; // Already have activity timer

    // Update player activity periodically (for vacation mode presence)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        get().updatePlayerActivity();
      }
    }, TIMEOUTS.ACTIVITY_CHECK);

    set({ pollingInterval: interval });
  },

  // Stop polling and disconnect
  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
    
    // Disconnect SyncManager (which stops polling)
    resetSyncManager();
  },

  // Refresh game state to get latest updates from Redis
  refreshGameState: async () => {
    const { currentGame } = get();
    if (!currentGame) return;

    try {
      // Fetch latest game state from server/Redis
      const latestGame = await loadGameByCode(currentGame.gameCode);

      // Only update if we actually got a game back
      if (latestGame) {
        get().handleRealtimeUpdate(latestGame);
      } else {
        // Game might have been deleted or is temporarily unavailable
        // Don't throw an error - just skip the update
      }
    } catch (error) {
      // Don't throw - just log the error to avoid triggering ErrorBoundary
    }
  },

  // Handle real-time updates from SSE or polling
  handleRealtimeUpdate: (latestGame: Game) => {
    const { currentGame, currentPlayerId, playerState } = get();
    if (!currentGame) return;

    // Ensure we have a complete game object for merging
    // If latestGame is a partial update, merge it with currentGame first
    let gameToMerge: Game;
    
    if (latestGame.settings) {
      // Full update - use as is
      gameToMerge = latestGame;
    } else {
      // Partial update - need to carefully merge items
      // If latestGame has items, merge them properly instead of replacing
      if (latestGame.items) {
        // Use the longer array to ensure we don't lose items
        const maxLength = Math.max(
          latestGame.items.length,
          currentGame.items?.length || 0
        );
        
        const mergedItems = [];
        for (let i = 0; i < maxLength; i++) {
          const currentItem = currentGame.items?.[i];
          const updatedItem = latestGame.items[i];
          
          if (updatedItem) {
            // If we have an update, merge it with current (if exists)
            if (currentItem) {
              mergedItems.push({
                ...currentItem,
                ...updatedItem,
                // Ensure text is always preserved
                text: updatedItem.text || currentItem.text,
              });
            } else {
              // New item from server
              mergedItems.push(updatedItem);
            }
          } else if (currentItem) {
            // Keep current item if no update
            mergedItems.push(currentItem);
          }
        }
        gameToMerge = { ...currentGame, ...latestGame, items: mergedItems };
      } else {
        gameToMerge = { ...currentGame, ...latestGame };
      }
    }

    // Use proper state merging to prevent overwrites
    const mergedGame = mergeGameStates(currentGame, gameToMerge);

    // Check if there's a new winner
    if (mergedGame.winner && !currentGame.winner) {
      
      // Check if WE are the winner
      if (mergedGame.winner.playerId === currentPlayerId) {
        // Clear any near-miss notification since we're the winner
        set(produce(draft => {
          draft.nearMissInfo = null;
        }));
      } else {
        // Someone else won, show near-miss notification if we were close
        
        // Check if we had a winning board (near miss scenario)
        if (playerState && currentGame.items && 
            playerState.markedPositions.length === currentGame.items.length) {
          // We had a winning board but someone else claimed it first
          const timeDiff = Date.now() - mergedGame.winner.wonAt;
          if (timeDiff < TIMEOUTS.NEAR_MISS_WINDOW) {
            set(produce(draft => {
              draft.nearMissInfo = {
                winnerName: mergedGame.winner!.displayName,
                timeDifference: timeDiff,
                showNotification: true,
              };
            }));
          }
        }
      }
    }

    // Check if new players joined
    const currentPlayerCount = currentGame.players?.length || 0;
    const latestPlayerCount = mergedGame.players?.length || 0;
    if (latestPlayerCount > currentPlayerCount) {
    }

    // Mark currently active players
    const now = Date.now();

    const updatedPlayers = mergedGame.players.map((p) => ({
      ...p,
      isOnline:
        p.id === currentPlayerId
          ? true
          : now - (p.lastSeenAt || 0) < TIMEOUTS.ONLINE_THRESHOLD,
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
        mergedGame.winner.playerId === currentPlayerId && 
        playerState && !playerState.hasWon) {
      set(produce(draft => {
        if (draft.playerState) {
          draft.playerState.hasWon = true;
        }
      }));
    }
  },

  // Set connection status
  setConnectionStatus: (isConnected: boolean) => {
    const previouslyConnected = get().isConnected;
    set({ isConnected });
    
    // When reconnecting, check if we have an unconfirmed win claim
    if (!previouslyConnected && isConnected) {
      const { optimisticWinClaim, playerState } = get();
      if (optimisticWinClaim && playerState?.hasWon) {
        // Re-attempt to claim the win
        get().announceWin();
      }
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

import type { Game, PlayerState } from "../types/types";

/**
 * SyncManager handles real-time synchronization of game state
 * using Server-Sent Events (SSE) and conflict resolution
 */

interface SyncCallbacks {
  onGameUpdate: (game: Game) => void;
  onConnectionChange: (isConnected: boolean) => void;
  onPlayerJoin?: (playerName: string) => void;
  onWinnerAnnounced?: (winnerName: string) => void;
}

class SyncManager {
  private eventSource: EventSource | null = null;
  private callbacks: SyncCallbacks;
  private gameCode: string | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private lastKnownVersion: string = "";

  constructor(callbacks: SyncCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Connect to SSE endpoint for real-time updates
   */
  connect(gameCode: string) {
    if (this.eventSource) {
      this.disconnect();
    }

    this.gameCode = gameCode;
    console.log(`[SyncManager] Connecting to game ${gameCode}...`);

    try {
      this.eventSource = new EventSource(`/api/sse/${gameCode}`);

      this.eventSource.onopen = () => {
        console.log("[SyncManager] SSE connection established");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.callbacks.onConnectionChange(true);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error("[SyncManager] Failed to parse message:", error);
        }
      };

      this.eventSource.onerror = () => {
        console.error("[SyncManager] SSE connection error");
        this.isConnected = false;
        this.callbacks.onConnectionChange(false);
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`[SyncManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
          
          setTimeout(() => {
            if (this.gameCode) {
              this.connect(this.gameCode);
            }
          }, delay);
        } else {
          console.error("[SyncManager] Max reconnection attempts reached");
          // Fall back to polling
          this.fallbackToPolling();
        }
      };
    } catch (error) {
      console.error("[SyncManager] Failed to create EventSource:", error);
      this.fallbackToPolling();
    }
  }

  /**
   * Handle incoming SSE messages
   */
  private handleMessage(data: any) {
    switch (data.type) {
      case "connected":
        console.log("[SyncManager] Connected to game:", data.gameCode);
        break;

      case "gameUpdate":
        const game = data.game;
        const currentVersion = JSON.stringify({
          lastModifiedAt: game.lastModifiedAt,
          playerCount: game.players?.length,
          winner: game.winner,
        });

        // Only process if version changed
        if (currentVersion !== this.lastKnownVersion) {
          console.log("[SyncManager] Game update received:", {
            playerCount: game.players?.length,
            hasWinner: !!game.winner,
            timestamp: data.timestamp,
          });

          this.lastKnownVersion = currentVersion;
          this.callbacks.onGameUpdate(game);

          // Check for specific events
          if (game.winner && this.callbacks.onWinnerAnnounced) {
            this.callbacks.onWinnerAnnounced(game.winner.displayName);
          }
        }
        break;

      default:
        console.log("[SyncManager] Unknown message type:", data.type);
    }
  }

  /**
   * Fallback to polling if SSE is not available
   */
  private fallbackToPolling() {
    console.log("[SyncManager] Falling back to polling mode");
    // This will be handled by the existing polling mechanism in gameStore
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect() {
    if (this.eventSource) {
      console.log("[SyncManager] Disconnecting SSE...");
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      this.callbacks.onConnectionChange(false);
    }
  }

  /**
   * Check if currently connected
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Force a reconnection
   */
  reconnect() {
    if (this.gameCode) {
      this.disconnect();
      this.connect(this.gameCode);
    }
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(callbacks?: SyncCallbacks): SyncManager {
  if (!syncManagerInstance && callbacks) {
    syncManagerInstance = new SyncManager(callbacks);
  }
  return syncManagerInstance!;
}

export function resetSyncManager() {
  if (syncManagerInstance) {
    syncManagerInstance.disconnect();
    syncManagerInstance = null;
  }
}

/**
 * Conflict resolution utilities
 */

export function mergeGameStates(local: Game, remote: Game): Game {
  // Remote is source of truth, but preserve local admin token if present
  const merged: Game = {
    ...remote,
    adminToken: local.adminToken || remote.adminToken,
  };

  // Merge players list without duplicates
  const playerMap = new Map<string, any>();
  
  // Add all remote players first (source of truth)
  remote.players?.forEach(player => {
    playerMap.set(player.displayName, player);
  });

  // Update with any local player that might have more recent activity
  local.players?.forEach(player => {
    const existing = playerMap.get(player.displayName);
    if (existing) {
      // Keep the more recent lastSeenAt
      if (player.lastSeenAt > existing.lastSeenAt) {
        playerMap.set(player.displayName, {
          ...existing,
          lastSeenAt: player.lastSeenAt,
          isOnline: player.isOnline,
        });
      }
    }
  });

  return {
    ...merged,
    players: Array.from(playerMap.values()),
    winner: remote.winner, // Always use remote winner (source of truth)
  };
}

export function mergePlayerStates(local: PlayerState, remote: PlayerState): PlayerState {
  // For player state, local changes take precedence (user's own actions)
  return {
    ...remote,
    markedPositions: local.markedPositions, // Keep user's local marks
    displayName: local.displayName,
    lastSyncAt: Math.max(local.lastSyncAt, remote.lastSyncAt || 0),
  };
}
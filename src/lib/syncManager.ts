import type { Game } from "../types/types";

/**
 * Simplified SyncManager using Server-Sent Events
 * Replaces 400+ lines of complex polling logic with ~50 lines
 */
class SyncManager {
  private eventSource: EventSource | null = null;
  private gameCode: string | null = null;
  private onUpdate: ((game: Game) => void) | null = null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;

  connect(
    gameCode: string,
    callbacks: {
      onGameUpdate: (game: Game) => void;
      onConnectionChange: (connected: boolean) => void;
    },
  ) {
    this.disconnect(); // Clean up any existing connection

    this.gameCode = gameCode;
    this.onUpdate = callbacks.onGameUpdate;
    this.onConnectionChange = callbacks.onConnectionChange;
    this.reconnectAttempts = 0;

    console.log(`[SyncManager] Connecting to game ${gameCode} via SSE`);

    // Create EventSource connection
    this.eventSource = new EventSource(`/api/game/events/${gameCode}`);

    // Handle incoming messages
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle errors
        if (data.error) {
          console.error(`[SyncManager] Server error: ${data.error}`);
          return;
        }

        // Update connection status
        if (!this.isConnected) {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.onConnectionChange?.(true);
          console.log(`[SyncManager] Connected to game ${gameCode}`);
        }

        // Update game state
        this.onUpdate?.(data);

        // Log online player count for debugging (only in development)
        if (
          data.onlineCount !== undefined &&
          process.env.NODE_ENV === "development"
        ) {
          console.log(
            `[SyncManager] Game ${gameCode}: ${data.onlineCount} players online`,
          );
        }
      } catch (error) {
        console.error("[SyncManager] Error parsing SSE data:", error);
      }
    };

    // Handle connection errors (automatic reconnection)
    this.eventSource.onerror = () => {
      console.log(
        `[SyncManager] Connection error, will auto-reconnect (attempt ${this.reconnectAttempts + 1})`,
      );

      if (this.isConnected) {
        this.isConnected = false;
        this.onConnectionChange?.(false);
      }

      this.reconnectAttempts++;

      // EventSource automatically reconnects with exponential backoff
      // We just log it for debugging
    };

    // Handle explicit open event
    this.eventSource.onopen = () => {
      console.log(`[SyncManager] SSE connection opened for game ${gameCode}`);
    };
  }

  disconnect() {
    if (this.eventSource) {
      console.log(`[SyncManager] Disconnecting from game ${this.gameCode}`);
      this.eventSource.close();
      this.eventSource = null;
      this.gameCode = null;

      if (this.isConnected) {
        this.isConnected = false;
        this.onConnectionChange?.(false);
      }
    }
  }

  // Simple activity marking - just for triggering immediate updates
  markActivity() {
    // With SSE, we don't need to manage polling intervals
    // Updates are pushed automatically
    console.log("[SyncManager] Activity marked (no-op with SSE)");
  }

  // Compatibility methods (no-op with SSE)
  pollNow() {
    console.log("[SyncManager] Poll requested (no-op with SSE)");
  }

  reconnect() {
    if (this.gameCode && this.onUpdate && this.onConnectionChange) {
      console.log("[SyncManager] Manual reconnect requested");
      this.connect(this.gameCode, {
        onGameUpdate: this.onUpdate,
        onConnectionChange: this.onConnectionChange,
      });
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  updateActivePlayerCount(_players: readonly any[]) {
    // No longer needed - server handles this
    console.log("[SyncManager] Player count update (no-op with SSE)");
  }

  cleanup() {
    this.disconnect();
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(callbacks?: {
  onGameUpdate: (game: Game) => void;
  onConnectionChange: (connected: boolean) => void;
}): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }

  // Connect if callbacks provided
  if (callbacks && !syncManagerInstance.getConnectionStatus()) {
    // Will be connected when gameStore calls connect()
  }

  return syncManagerInstance;
}

export function resetSyncManager() {
  if (syncManagerInstance) {
    syncManagerInstance.cleanup();
    syncManagerInstance = null;
  }
}

// Remove all the merge functions - no longer needed with SSE
// The server is the single source of truth

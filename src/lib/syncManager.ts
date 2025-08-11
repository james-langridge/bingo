import type { Game, PlayerState } from "../types/types";

/**
 * SyncManager handles real-time synchronization of game state
 * using smart polling with adaptive intervals.
 * 
 * Note: SSE (Server-Sent Events) doesn't work on Vercel due to function
 * timeout limits (10 seconds for hobby, 60 seconds for pro). Instead,
 * we use intelligent polling that adjusts based on activity.
 */

interface SyncCallbacks {
  onGameUpdate: (game: Game) => void;
  onConnectionChange: (isConnected: boolean) => void;
  onPlayerJoin?: (playerName: string) => void;
  onWinnerAnnounced?: (winnerName: string) => void;
}

interface PollingState {
  interval: number;
  lastActivityTime: number;
  lastSyncTime: number;
  lastVersion: string;
  consecutiveErrors: number;
}

class SyncManager {
  private pollingTimer: NodeJS.Timeout | null = null;
  private callbacks: SyncCallbacks;
  private gameCode: string | null = null;
  private isConnected: boolean = false;
  private pollingState: PollingState = {
    interval: 2000, // Start with 2 seconds
    lastActivityTime: Date.now(),
    lastSyncTime: 0,
    lastVersion: "",
    consecutiveErrors: 0,
  };
  
  // Polling interval configuration
  private readonly ACTIVE_INTERVAL = 2000;    // 2 seconds during active play
  private readonly IDLE_INTERVAL = 10000;     // 10 seconds after 1 minute idle
  private readonly INACTIVE_INTERVAL = 30000; // 30 seconds after 5 minutes idle
  private readonly IMMEDIATE_POLL_DELAY = 100; // Near-instant poll after user action
  
  private visibilityHandler: (() => void) | null = null;
  private isDocumentVisible: boolean = true;

  constructor(callbacks: SyncCallbacks) {
    this.callbacks = callbacks;
    this.setupVisibilityHandling();
  }

  /**
   * Setup document visibility handling to pause/resume polling
   */
  private setupVisibilityHandling() {
    this.visibilityHandler = () => {
      const wasVisible = this.isDocumentVisible;
      this.isDocumentVisible = !document.hidden;
      
      if (!wasVisible && this.isDocumentVisible && this.gameCode) {
        // Tab became visible - immediately poll for updates
        console.log("[SyncManager] Tab became visible, polling immediately");
        this.pollNow();
      } else if (!this.isDocumentVisible) {
        // Tab became hidden - pause polling
        console.log("[SyncManager] Tab hidden, pausing polling");
      }
    };
    
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  /**
   * Start smart polling for game updates
   */
  connect(gameCode: string) {
    this.disconnect();
    
    this.gameCode = gameCode;
    this.pollingState.lastActivityTime = Date.now();
    console.log(`[SyncManager] Starting smart polling for game ${gameCode}`);
    
    // Start polling immediately
    this.startPolling();
  }

  /**
   * Calculate the appropriate polling interval based on activity
   */
  private calculateInterval(): number {
    const now = Date.now();
    const timeSinceActivity = now - this.pollingState.lastActivityTime;
    
    // If document is hidden, use a longer interval
    if (!this.isDocumentVisible) {
      return this.INACTIVE_INTERVAL;
    }
    
    // Active play: < 1 minute since last activity
    if (timeSinceActivity < 60000) {
      return this.ACTIVE_INTERVAL;
    }
    
    // Idle: 1-5 minutes since last activity
    if (timeSinceActivity < 300000) {
      return this.IDLE_INTERVAL;
    }
    
    // Inactive: > 5 minutes since last activity
    return this.INACTIVE_INTERVAL;
  }

  /**
   * Perform a single poll for game changes
   */
  private async poll() {
    if (!this.gameCode || !this.isDocumentVisible) {
      return;
    }
    
    try {
      const params = new URLSearchParams({
        since: this.pollingState.lastSyncTime.toString(),
        version: this.pollingState.lastVersion,
      });
      
      const response = await fetch(`/api/game/changes/${this.gameCode}?${params}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (response.status === 304) {
        // No changes
        this.handleSuccessfulPoll();
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      this.handlePollResponse(data);
      this.handleSuccessfulPoll();
      
    } catch (error) {
      this.handlePollError(error);
    }
  }

  /**
   * Handle successful poll response
   */
  private handlePollResponse(data: any) {
    const { version, lastModifiedAt, changes, timestamp } = data;
    
    // Update version tracking
    if (version !== this.pollingState.lastVersion) {
      this.pollingState.lastVersion = version;
      this.pollingState.lastSyncTime = lastModifiedAt || timestamp;
      
      // Process game update
      if (changes.fullUpdate && changes.game) {
        console.log("[SyncManager] Full game update received");
        this.callbacks.onGameUpdate(changes.game);
        
        // Check for winner announcement
        if (changes.game.winner && this.callbacks.onWinnerAnnounced) {
          this.callbacks.onWinnerAnnounced(changes.game.winner.displayName);
        }
      } else {
        // Handle incremental update
        console.log("[SyncManager] Incremental update received");
        // The store will handle merging the partial data
        this.callbacks.onGameUpdate({
          players: changes.players,
          winner: changes.winner,
          items: changes.items,
          lastModifiedAt: lastModifiedAt,
        } as any);
      }
    }
  }

  /**
   * Handle successful poll (reset error counter, update connection status)
   */
  private handleSuccessfulPoll() {
    if (this.pollingState.consecutiveErrors > 0) {
      this.pollingState.consecutiveErrors = 0;
      console.log("[SyncManager] Connection restored");
    }
    
    if (!this.isConnected) {
      this.isConnected = true;
      this.callbacks.onConnectionChange(true);
    }
  }

  /**
   * Handle polling error
   */
  private handlePollError(error: any) {
    this.pollingState.consecutiveErrors++;
    console.error("[SyncManager] Polling error:", error);
    
    // Mark as disconnected after 3 consecutive errors
    if (this.pollingState.consecutiveErrors >= 3 && this.isConnected) {
      this.isConnected = false;
      this.callbacks.onConnectionChange(false);
    }
    
    // Exponential backoff on errors (max 30 seconds)
    const backoffInterval = Math.min(
      this.ACTIVE_INTERVAL * Math.pow(2, this.pollingState.consecutiveErrors),
      this.INACTIVE_INTERVAL
    );
    this.pollingState.interval = backoffInterval;
  }

  /**
   * Start the polling loop
   */
  private startPolling() {
    this.stopPolling();
    
    const pollAndSchedule = async () => {
      await this.poll();
      
      // Calculate next interval
      this.pollingState.interval = this.calculateInterval();
      
      // Schedule next poll if still connected
      if (this.gameCode) {
        this.pollingTimer = setTimeout(pollAndSchedule, this.pollingState.interval);
      }
    };
    
    // Start immediately
    pollAndSchedule();
  }

  /**
   * Stop polling
   */
  private stopPolling() {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Mark activity and optionally trigger immediate poll
   */
  markActivity(immediate: boolean = false) {
    this.pollingState.lastActivityTime = Date.now();
    
    if (immediate && this.gameCode) {
      // Cancel current timer and poll immediately
      this.stopPolling();
      setTimeout(() => this.startPolling(), this.IMMEDIATE_POLL_DELAY);
    }
  }

  /**
   * Force an immediate poll
   */
  pollNow() {
    if (this.gameCode) {
      this.markActivity(true);
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    console.log("[SyncManager] Stopping polling");
    this.stopPolling();
    this.gameCode = null;
    
    if (this.isConnected) {
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
      console.log("[SyncManager] Reconnecting...");
      this.pollingState.consecutiveErrors = 0;
      this.startPolling();
    }
  }
  
  /**
   * Cleanup event listeners
   */
  cleanup() {
    this.disconnect();
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
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
    syncManagerInstance.cleanup();
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

  // Merge items to preserve markedBy data (vacation mode feature) and all fields
  const mergedItems = remote.items.map((remoteItem, index) => {
    const localItem = local.items[index];
    
    // Start with local item to preserve all fields, then overlay remote updates
    const baseItem = localItem || remoteItem;
    
    // Merge markedBy arrays
    const markedByMap = new Map();
    
    // Add remote marks first
    remoteItem.markedBy?.forEach(mark => {
      markedByMap.set(mark.playerId, mark);
    });
    
    // Add or update with local marks (might be more recent)
    localItem?.markedBy?.forEach(mark => {
      const existing = markedByMap.get(mark.playerId);
      if (!existing || mark.markedAt > existing.markedAt) {
        markedByMap.set(mark.playerId, mark);
      }
    });
    
    return {
      ...baseItem,  // Start with all fields from local (including text)
      ...remoteItem, // Overlay remote updates
      // Ensure critical fields are preserved
      text: remoteItem.text || baseItem.text,
      position: remoteItem.position ?? baseItem.position,
      id: remoteItem.id || baseItem.id,
      markedBy: Array.from(markedByMap.values()).sort((a, b) => a.markedAt - b.markedAt),
    };
  });

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
    items: mergedItems,
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
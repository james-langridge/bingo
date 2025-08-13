import type {
  Game,
  PlayerState,
  Player,
  WinnerInfo,
  BingoItem,
} from "../types/types";
import { POLLING, TIMEOUTS } from "./constants";

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
  activePlayerCount: number;
}

class SyncManager {
  private pollingTimer: NodeJS.Timeout | null = null;
  private callbacks: SyncCallbacks;
  private gameCode: string | null = null;
  private isConnected: boolean = false;
  private pollingState: PollingState = {
    interval: POLLING.ACTIVE,
    lastActivityTime: Date.now(),
    lastSyncTime: 0,
    lastVersion: "",
    consecutiveErrors: 0,
    activePlayerCount: 0,
  };

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
        this.pollNow();
      } else if (!this.isDocumentVisible) {
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

    this.startPolling();
  }

  /**
   * Calculate the appropriate polling interval based on activity and online players
   */
  private calculateInterval(): number {
    const now = Date.now();
    const timeSinceActivity = now - this.pollingState.lastActivityTime;

    if (!this.isDocumentVisible) {
      return POLLING.INACTIVE;
    }

    // If multiple players are online, always use active polling
    if (this.pollingState.activePlayerCount > 1) {
      console.log(
        `[SyncManager] Multiple players online (${this.pollingState.activePlayerCount}), using ACTIVE polling (${POLLING.ACTIVE}ms)`,
      );
      return POLLING.ACTIVE;
    }

    // Single player: use activity-based intervals
    if (timeSinceActivity < POLLING.IDLE_THRESHOLD) {
      console.log(
        `[SyncManager] Single player, recent activity, using ACTIVE polling (${POLLING.ACTIVE}ms)`,
      );
      return POLLING.ACTIVE;
    }

    if (timeSinceActivity < POLLING.INACTIVE_THRESHOLD) {
      console.log(
        `[SyncManager] Single player, idle, using IDLE polling (${POLLING.IDLE}ms)`,
      );
      return POLLING.IDLE;
    }

    console.log(
      `[SyncManager] Single player, inactive, using INACTIVE polling (${POLLING.INACTIVE}ms)`,
    );
    return POLLING.INACTIVE;
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
        since: (this.pollingState.lastSyncTime || 0).toString(),
        version: this.pollingState.lastVersion || "",
      });

      const response = await fetch(
        `/api/game/changes/${this.gameCode}?${params}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Check if this is a no-changes response
      if (data.noChanges) {
        // Still update player count even when no game changes
        if (typeof data.activePlayerCount === "number") {
          const prevCount = this.pollingState.activePlayerCount;
          this.pollingState.activePlayerCount = data.activePlayerCount;
          if (prevCount !== data.activePlayerCount) {
            console.log(
              `[SyncManager] Player count changed: ${prevCount} -> ${data.activePlayerCount}`,
            );
          }
        }
        this.handleSuccessfulPoll();
        return;
      }

      this.handlePollResponse(data);
      this.handleSuccessfulPoll();
    } catch (error) {
      this.handlePollError(error);
    }
  }

  /**
   * Handle successful poll response
   */
  private handlePollResponse(data: unknown) {
    if (!data || typeof data !== "object") {
      return;
    }

    const response = data as {
      version?: string;
      lastModifiedAt?: number;
      timestamp?: number;
      activePlayerCount?: number;
      changes?: {
        fullUpdate?: boolean;
        game?: Game;
        players?: readonly Player[];
        winner?: WinnerInfo;
        items?: readonly BingoItem[];
      };
    };

    const { version, lastModifiedAt, changes, timestamp, activePlayerCount } =
      response;

    // Always update active player count if provided
    if (typeof activePlayerCount === "number") {
      const prevCount = this.pollingState.activePlayerCount;
      this.pollingState.activePlayerCount = activePlayerCount;
      if (prevCount !== activePlayerCount) {
        console.log(
          `[SyncManager] Player count updated: ${prevCount} -> ${activePlayerCount}`,
        );
      }
    } else {
      // Fallback: calculate from players data if available
      if (changes?.players) {
        const now = Date.now();
        const activePlayers = changes.players.filter(
          (p) => now - (p.lastSeenAt || 0) < TIMEOUTS.ONLINE_THRESHOLD,
        );
        this.pollingState.activePlayerCount = activePlayers.length;
      } else if (changes?.fullUpdate && changes.game?.players) {
        const now = Date.now();
        const activePlayers = changes.game.players.filter(
          (p) => now - (p.lastSeenAt || 0) < TIMEOUTS.ONLINE_THRESHOLD,
        );
        this.pollingState.activePlayerCount = activePlayers.length;
      }
    }

    if (version && version !== this.pollingState.lastVersion) {
      this.pollingState.lastVersion = version;
      this.pollingState.lastSyncTime =
        lastModifiedAt || timestamp || Date.now();

      if (changes) {
        if (changes.fullUpdate && changes.game) {
          // Ensure lastModifiedAt is set on full updates
          const gameWithTimestamp = {
            ...changes.game,
            lastModifiedAt:
              lastModifiedAt || changes.game.lastModifiedAt || Date.now(),
          };
          this.callbacks.onGameUpdate(gameWithTimestamp);

          if (changes.game.winner && this.callbacks.onWinnerAnnounced) {
            this.callbacks.onWinnerAnnounced(changes.game.winner.displayName);
          }
        } else {
          // Partial update with specific fields
          this.callbacks.onGameUpdate({
            players: changes.players,
            winner: changes.winner,
            items: changes.items,
            lastModifiedAt: lastModifiedAt || Date.now(),
          } as Game);
        }
      }
    }
  }

  /**
   * Handle successful poll (reset error counter, update connection status)
   */
  private handleSuccessfulPoll() {
    if (this.pollingState.consecutiveErrors > 0) {
      this.pollingState.consecutiveErrors = 0;
    }

    if (!this.isConnected) {
      this.isConnected = true;
      this.callbacks.onConnectionChange(true);
    }
  }

  /**
   * Handle polling error
   */
  private handlePollError(_error: unknown) {
    this.pollingState.consecutiveErrors++;

    if (this.pollingState.consecutiveErrors >= 3 && this.isConnected) {
      this.isConnected = false;
      this.callbacks.onConnectionChange(false);
    }

    const backoffInterval = Math.min(
      POLLING.ACTIVE * Math.pow(2, this.pollingState.consecutiveErrors),
      POLLING.INACTIVE,
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

      this.pollingState.interval = this.calculateInterval();

      if (this.gameCode) {
        this.pollingTimer = setTimeout(
          pollAndSchedule,
          this.pollingState.interval,
        );
      }
    };

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
      this.stopPolling();
      setTimeout(() => this.startPolling(), POLLING.IMMEDIATE_DELAY);
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
      this.pollingState.consecutiveErrors = 0;
      this.startPolling();
    }
  }

  /**
   * Update the active player count (called from store when game state changes)
   */
  updateActivePlayerCount(players: readonly Player[]) {
    const now = Date.now();
    const activePlayers = players.filter(
      (p) => now - (p.lastSeenAt || 0) < TIMEOUTS.ONLINE_THRESHOLD,
    );
    const previousCount = this.pollingState.activePlayerCount;
    this.pollingState.activePlayerCount = activePlayers.length;

    // If player count increased and we were in slow polling, speed up
    if (activePlayers.length > previousCount && activePlayers.length > 1) {
      this.markActivity(true);
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
  // Handle partial updates where remote might not have all fields
  let mergedItems = local.items || [];

  // If remote has items, merge them properly
  if (remote.items && remote.items.length > 0) {
    mergedItems = remote.items.map((remoteItem, index) => {
      const localItem = local.items?.[index];

      // If no local item exists, use remote
      if (!localItem) {
        return remoteItem;
      }

      // Merge markedBy arrays
      const markedByMap = new Map();

      // Add remote marks first
      remoteItem.markedBy?.forEach((mark) => {
        markedByMap.set(mark.playerId, mark);
      });

      // Add local marks, keeping newer ones
      localItem.markedBy?.forEach((mark) => {
        const existing = markedByMap.get(mark.playerId);
        if (!existing || mark.markedAt > existing.markedAt) {
          markedByMap.set(mark.playerId, mark);
        }
      });

      return {
        ...localItem,
        ...remoteItem,
        text: remoteItem.text || localItem.text,
        position: remoteItem.position ?? localItem.position,
        id: remoteItem.id || localItem.id,
        markedBy: Array.from(markedByMap.values()).sort(
          (a, b) => a.markedAt - b.markedAt,
        ),
      };
    });
  }

  const playerMap = new Map<string, Player>();

  remote.players?.forEach((player) => {
    playerMap.set(player.displayName, player);
  });

  local.players?.forEach((player) => {
    const existing = playerMap.get(player.displayName);
    if (existing) {
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
    ...local,
    ...remote,
    adminToken: local.adminToken || remote.adminToken,
    items: mergedItems,
    players: Array.from(playerMap.values()),
    winner: remote.winner,
  };
}

export function mergePlayerStates(
  local: PlayerState,
  remote: PlayerState,
): PlayerState {
  return {
    ...remote,
    markedPositions: local.markedPositions,
    displayName: local.displayName,
    lastSyncAt: Math.max(local.lastSyncAt, remote.lastSyncAt || 0),
  };
}

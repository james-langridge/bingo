import type {
  Game,
  PlayerState,
  Player,
  WinnerInfo,
  BingoItem,
} from "../types/types";
import { POLLING } from "./constants";

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
    interval: POLLING.ACTIVE,
    lastActivityTime: Date.now(),
    lastSyncTime: 0,
    lastVersion: "",
    consecutiveErrors: 0,
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
   * Calculate the appropriate polling interval based on activity
   */
  private calculateInterval(): number {
    const now = Date.now();
    const timeSinceActivity = now - this.pollingState.lastActivityTime;

    if (!this.isDocumentVisible) {
      return POLLING.INACTIVE;
    }

    if (timeSinceActivity < POLLING.IDLE_THRESHOLD) {
      return POLLING.ACTIVE;
    }

    if (timeSinceActivity < POLLING.INACTIVE_THRESHOLD) {
      return POLLING.IDLE;
    }

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

      if (response.status === 304) {
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
  private handlePollResponse(data: unknown) {
    if (!data || typeof data !== "object") {
      return;
    }

    const response = data as {
      version?: string;
      lastModifiedAt?: number;
      timestamp?: number;
      changes?: {
        fullUpdate?: boolean;
        game?: Game;
        players?: readonly Player[];
        winner?: WinnerInfo;
        items?: readonly BingoItem[];
      };
    };

    const { version, lastModifiedAt, changes, timestamp } = response;

    if (version && version !== this.pollingState.lastVersion) {
      this.pollingState.lastVersion = version;
      this.pollingState.lastSyncTime =
        lastModifiedAt || timestamp || Date.now();

      if (changes) {
        if (changes.fullUpdate && changes.game) {
          this.callbacks.onGameUpdate(changes.game);

          if (changes.game.winner && this.callbacks.onWinnerAnnounced) {
            this.callbacks.onWinnerAnnounced(changes.game.winner.displayName);
          }
        } else {
          this.callbacks.onGameUpdate({
            players: changes.players,
            winner: changes.winner,
            items: changes.items,
            lastModifiedAt: lastModifiedAt,
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
  const merged: Game = {
    ...remote,
    adminToken: local.adminToken || remote.adminToken,
  };

  const mergedItems = remote.items.map((remoteItem, index) => {
    const localItem = local.items[index];

    const baseItem = localItem || remoteItem;

    const markedByMap = new Map();

    remoteItem.markedBy?.forEach((mark) => {
      markedByMap.set(mark.playerId, mark);
    });

    localItem?.markedBy?.forEach((mark) => {
      const existing = markedByMap.get(mark.playerId);
      if (!existing || mark.markedAt > existing.markedAt) {
        markedByMap.set(mark.playerId, mark);
      }
    });

    return {
      ...baseItem,
      ...remoteItem,
      text: remoteItem.text || baseItem.text,
      position: remoteItem.position ?? baseItem.position,
      id: remoteItem.id || baseItem.id,
      markedBy: Array.from(markedByMap.values()).sort(
        (a, b) => a.markedAt - b.markedAt,
      ),
    };
  });

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
    ...merged,
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

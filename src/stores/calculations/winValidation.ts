import type { PlayerState, Game, WinnerInfo } from "../../types/types";

/**
 * Check if a player has won based on marked positions
 */
export function checkWinCondition(
  playerState: PlayerState,
  game: Game
): boolean {
  if (playerState.hasWon) {
    return true;
  }

  if (game.winner && game.winner.displayName !== playerState.displayName) {
    return false;
  }

  const totalItems = game.items.length;
  return playerState.markedPositions.length === totalItems;
}

/**
 * Create winner info for a player
 */
export function createWinnerInfo(
  playerId: string,
  displayName: string,
  game: Game,
  markedPositions: readonly number[]
): WinnerInfo & { winningPositions?: readonly number[] } {
  return {
    playerId,
    displayName,
    wonAt: Date.now(),
    winType: game.settings.requireFullCard ? "fullCard" : "line",
    winningPositions: markedPositions,
  };
}

/**
 * Check if a win claim happened within the near-miss window
 */
export function isNearMiss(
  timeDifference: number,
  nearMissWindow: number
): boolean {
  return timeDifference < nearMissWindow;
}
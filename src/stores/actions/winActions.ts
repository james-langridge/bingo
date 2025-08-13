import type { Game, PlayerState } from "../../types/types";
import { saveGameLocal, savePlayerState } from "../../lib/storage";
import {
  checkWinCondition,
  createWinnerInfo,
} from "../calculations/winValidation";
import { markPlayerAsWinner } from "../calculations/gameCalculations";
import { getSyncManager } from "../../lib/syncManager";

interface WinClaimResult {
  accepted: boolean;
  game: Game;
}

/**
 * Check if current player has won
 */
export async function checkForWinner(
  game: Game,
  playerState: PlayerState,
): Promise<boolean> {
  if (!checkWinCondition(playerState, game)) {
    return false;
  }

  if (game.winner?.displayName === playerState.displayName) {
    const updatedPlayerState: PlayerState = {
      ...playerState,
      hasWon: true,
    };
    await savePlayerState(updatedPlayerState);
    return true;
  }

  return true;
}

/**
 * Attempt to claim victory
 */
export async function claimWin(
  game: Game,
  playerState: PlayerState,
  playerId: string,
): Promise<WinClaimResult> {
  const syncManager = getSyncManager();
  if (syncManager) {
    syncManager.markActivity();
  }

  let latestGame: Game | null = null;
  if (navigator.onLine) {
    try {
      const response = await fetch(`/api/game/${game.gameCode}`);
      if (response.ok) {
        latestGame = await response.json();
      }
    } catch (error) {}
  }

  if (latestGame?.winner) {
    if (latestGame.winner.playerId === playerId) {
      return { accepted: true, game: latestGame };
    }

    return { accepted: false, game: latestGame };
  }

  const winner = createWinnerInfo(
    playerId,
    playerState.displayName,
    game,
    playerState.markedPositions,
  );
  const optimisticGame: Game = {
    ...markPlayerAsWinner(game, playerId),
    winner,
  };

  await saveGameLocal(optimisticGame);

  if (navigator.onLine) {
    try {
      const response = await fetch(`/api/game/${game.gameCode}/claim-win`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          displayName: playerState.displayName,
          winType: winner.winType,
          winningPositions: winner.winningPositions,
          clientTimestamp: Date.now(),
        }),
      });

      const result = await response.json();

      if (response.ok && result.accepted) {
        return { accepted: true, game: result.game };
      } else if (result.actualWinner) {
        return { accepted: false, game: result.game };
      }
    } catch (error) {}
  }

  return { accepted: true, game: optimisticGame };
}

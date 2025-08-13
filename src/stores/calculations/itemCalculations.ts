import type { BingoItem } from "../../types/types";

/**
 * Toggle a mark on an item for a specific player
 */
export function toggleItemMark(
  item: BingoItem,
  playerId: string,
  displayName: string,
  isUnmarking: boolean,
): BingoItem {
  const markedBy = item.markedBy || [];
  const existingMarkIndex = markedBy.findIndex(
    (mark) => mark.playerId === playerId,
  );

  if (isUnmarking && existingMarkIndex >= 0) {
    return {
      ...item,
      markedBy: markedBy.filter((_, i) => i !== existingMarkIndex),
    };
  } else if (!isUnmarking && existingMarkIndex < 0) {
    const newMark = {
      playerId,
      displayName,
      markedAt: Date.now(),
    };
    return {
      ...item,
      markedBy: [...markedBy, newMark],
    };
  }

  return item;
}

/**
 * Update marked positions for a player
 */
export function updateMarkedPositions(
  currentPositions: readonly number[],
  position: number,
  isUnmarking: boolean,
): number[] {
  if (isUnmarking) {
    return currentPositions.filter((pos) => pos !== position);
  } else {
    return [...currentPositions, position];
  }
}

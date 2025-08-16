import type { BingoItem } from "../types/types";

interface UseGameBoardProps {
  items: readonly BingoItem[];
  currentPlayerId?: string;
}

interface UseGameBoardReturn {
  getMarkedByOthers: (item: BingoItem) => readonly {
    playerId: string;
    displayName: string;
    markedAt: string;
  }[];
}

export function useGameBoard({
  currentPlayerId,
}: UseGameBoardProps): UseGameBoardReturn {
  const getMarkedByOthers = (item: BingoItem) => {
    const markedBy = item.markedBy || [];
    const others = currentPlayerId
      ? markedBy.filter((mark) => mark.playerId !== currentPlayerId)
      : markedBy;

    // Map to the expected format
    return others.map((mark) => ({
      playerId: mark.playerId,
      displayName: mark.displayName,
      markedAt: new Date(mark.markedAt).toISOString(),
    }));
  };

  return {
    getMarkedByOthers,
  };
}

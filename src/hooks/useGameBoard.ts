import { useMemo } from "react";
import type { BingoItem } from "../types/types";
import { 
  calculateTileSize, 
  generateTileSeed,
  type TileSize 
} from "../lib/gameboard/calculations";

interface UseGameBoardProps {
  items: readonly BingoItem[];
  currentPlayerId?: string;
}

interface UseGameBoardReturn {
  tileSizes: TileSize[];
  getMarkedByOthers: (item: BingoItem) => readonly {
    playerId: string;
    displayName: string;
    markedAt: string;
  }[];
}

export function useGameBoard({ 
  items, 
  currentPlayerId 
}: UseGameBoardProps): UseGameBoardReturn {
  
  const tileSizes = useMemo(() => {
    return items.map((item, index) => {
      if (!item?.text) {
        return { cols: 1, rows: 1 };
      }
      
      const seed = generateTileSeed(item.text, index);
      return calculateTileSize(item.text, seed);
    });
  }, [items]);
  
  const getMarkedByOthers = (item: BingoItem) => {
    const markedBy = item.markedBy || [];
    const others = currentPlayerId 
      ? markedBy.filter(mark => mark.playerId !== currentPlayerId)
      : markedBy;
    
    // Map to the expected format
    return others.map(mark => ({
      playerId: mark.playerId,
      displayName: mark.displayName,
      markedAt: new Date(mark.markedAt).toISOString()
    }));
  };
  
  return {
    tileSizes,
    getMarkedByOthers,
  };
}
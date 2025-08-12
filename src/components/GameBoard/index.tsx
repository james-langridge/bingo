import { memo } from "react";
import type { BingoItem } from "../../types/types";
import { BingoTile } from "./BingoTile";
import { useGameBoard } from "../../hooks/useGameBoard";
import { useResponsiveGrid } from "../../hooks/useResponsiveGrid";
import { GRID_CONFIG } from "../../lib/constants";

interface GameBoardProps {
  items: readonly BingoItem[];
  markedPositions: readonly number[];
  gridSize: number;
  onItemClick: (position: number) => void;
  enableHaptic?: boolean;
  currentPlayerId?: string;
  currentPlayerName?: string;
}

export const GameBoard = memo(({
  items,
  markedPositions,
  gridSize: _gridSize, // Kept for API compatibility
  onItemClick,
  enableHaptic = true,
  currentPlayerId,
}: GameBoardProps) => {
  const { tileSizes, getMarkedByOthers } = useGameBoard({ items, currentPlayerId });
  const gridColumns = useResponsiveGrid();
  
  return (
    <>
      <div
        className="grid gap-3 p-4 w-full max-w-6xl mx-auto"
        style={{ 
          gridTemplateColumns: gridColumns,
          gridAutoRows: GRID_CONFIG.AUTO_ROW_HEIGHT,
          gridAutoFlow: 'dense'
        }}
      >
        {items.map((item, index) => {
          const isMarkedByMe = markedPositions.includes(item.position);
          const markedByOthers = getMarkedByOthers(item);
          
          return (
            <BingoTile
              key={`${item.id}-${index}`}
              item={item}
              tileSize={tileSizes[index]}
              isMarkedByMe={isMarkedByMe}
              markedByOthers={markedByOthers}
              onClick={() => onItemClick(item.position)}
              enableHaptic={enableHaptic}
            />
          );
        })}
      </div>
      
      <style>{`
        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.12); }
          100% { transform: scale(1.02); }
        }
      `}</style>
    </>
  );
});

GameBoard.displayName = 'GameBoard';
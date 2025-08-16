import { memo } from "react";
import type { BingoItem } from "../../types/types";
import { BingoTile } from "./BingoTile";
import { useGameBoard } from "../../hooks/useGameBoard";

interface GameBoardProps {
  items: readonly BingoItem[];
  markedPositions: readonly number[];
  gridSize: number;
  onItemClick: (position: number) => void;
  enableHaptic?: boolean;
  currentPlayerId?: string;
  currentPlayerName?: string;
}

export const GameBoard = memo(
  ({
    items,
    markedPositions,
    gridSize: _gridSize, // Kept for API compatibility
    onItemClick,
    enableHaptic = true,
    currentPlayerId,
  }: GameBoardProps) => {
    const { getMarkedByOthers } = useGameBoard({
      items,
      currentPlayerId,
    });

    return (
      <>
        <div className="flex flex-col gap-2 p-4 w-full max-w-2xl mx-auto">
          {items.map((item, index) => {
            const isMarkedByMe = markedPositions.includes(item.position);
            const markedByOthers = getMarkedByOthers(item);

            return (
              <BingoTile
                key={`${item.id}-${index}`}
                item={item}
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
  },
);

GameBoard.displayName = "GameBoard";

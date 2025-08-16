import { memo } from "react";
import type { BingoItem } from "../../types/types";
import { BingoTile } from "./BingoTile";

interface GameBoardProps {
  items: readonly BingoItem[];
  itemCounts: Record<number, number>;
  gridSize: number;
  onItemClick: (position: number) => void;
  enableHaptic?: boolean;
}

export const GameBoard = memo(
  ({
    items,
    itemCounts,
    gridSize: _gridSize, // Kept for API compatibility
    onItemClick,
    enableHaptic = true,
  }: GameBoardProps) => {
    return (
      <>
        <div className="flex flex-col gap-1.5 p-1 w-full max-w-2xl mx-auto">
          {items.map((item, index) => {
            const count = itemCounts[item.position] || 0;

            return (
              <BingoTile
                key={`${item.id}-${index}`}
                item={item}
                count={count}
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

import { memo } from "react";

interface BingoItem {
  id: string;
  text: string;
  position: number;
}

interface GameBoardProps {
  items: readonly BingoItem[];
  markedPositions: readonly number[];
  gridSize: number;
  onItemClick: (position: number) => void;
  enableHaptic?: boolean;
}

// Pure presentational component
export const GameBoard = memo(
  ({
    items,
    markedPositions,
    gridSize,
    onItemClick,
    enableHaptic = true,
  }: GameBoardProps) => {
    const handleClick = (position: number) => {
      // Add haptic feedback on mobile
      if (enableHaptic && "vibrate" in navigator) {
        navigator.vibrate(10);
      }
      onItemClick(position);
    };

    return (
      <div
        className={`grid gap-2 p-4 w-full max-w-2xl mx-auto`}
        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
      >
        {items.map((item, index) => {
          const isMarked = markedPositions.includes(index);
          return (
            <button
              key={`${item.id}-${index}`}
              onClick={() => handleClick(index)}
              className={`
              aspect-square p-3 rounded-xl text-sm md:text-base font-medium
              transition-all transform active:scale-95
              min-h-[60px] min-w-[60px] md:min-h-[80px] md:min-w-[80px]
              flex items-center justify-center text-center
              ${
                isMarked
                  ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg scale-105"
                  : "bg-white text-gray-800 shadow-md border-2 border-gray-200 hover:border-purple-300"
              }
            `}
              style={{
                animation: isMarked ? "pop 0.3s ease-out" : undefined,
              }}
            >
              <span className="break-words hyphens-auto">{item.text}</span>
            </button>
          );
        })}

        <style>{`
        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1.05); }
        }
      `}</style>
      </div>
    );
  },
);

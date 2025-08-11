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

// Pure presentational component with responsive masonry layout
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

    // Calculate responsive columns based on grid size and screen size
    const getGridColumns = () => {
      if (gridSize <= 3) return `repeat(${gridSize}, minmax(100px, 1fr))`;
      if (gridSize === 4) return `repeat(auto-fit, minmax(120px, 1fr))`;
      return `repeat(auto-fit, minmax(140px, 1fr))`;
    };

    return (
      <div
        className={`grid gap-3 p-4 w-full max-w-5xl mx-auto`}
        style={{ 
          gridTemplateColumns: getGridColumns(),
          gridAutoRows: 'min-content',
          gridAutoFlow: 'dense'
        }}
      >
        {items.map((item, index) => {
          const isMarked = markedPositions.includes(index);
          const textLength = item.text.length;
          
          // Determine tile span based on text length
          const getGridSpan = () => {
            if (textLength > 200) return 'span 2';
            if (textLength > 100) return 'span 1';
            return 'span 1';
          };
          
          // Calculate appropriate padding based on text length
          const getPadding = () => {
            if (textLength < 20) return 'p-4';
            if (textLength < 50) return 'p-3';
            return 'p-2.5';
          };

          return (
            <button
              key={`${item.id}-${index}`}
              onClick={() => handleClick(index)}
              className={`
              ${getPadding()} rounded-xl font-medium
              transition-all transform active:scale-95
              min-h-[80px] w-full
              flex items-center justify-center text-center
              break-words hyphens-auto
              ${
                isMarked
                  ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg scale-[1.02] hover:scale-105"
                  : "bg-white text-gray-800 shadow-md border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg"
              }
            `}
              style={{
                animation: isMarked ? "pop 0.3s ease-out" : undefined,
                gridColumn: textLength > 200 && gridSize >= 4 ? getGridSpan() : undefined,
                fontSize: textLength > 150 ? '0.875rem' : textLength > 80 ? '0.9375rem' : '1rem',
                lineHeight: textLength > 100 ? '1.4' : '1.5',
              }}
            >
              <span className="max-w-full overflow-wrap-anywhere">
                {item.text}
              </span>
            </button>
          );
        })}

        <style>{`
        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.12); }
          100% { transform: scale(1.02); }
        }
        
        @media (max-width: 640px) {
          .grid {
            grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)) !important;
          }
        }
        
        @media (min-width: 1024px) {
          .grid {
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) !important;
          }
        }
      `}</style>
      </div>
    );
  },
);

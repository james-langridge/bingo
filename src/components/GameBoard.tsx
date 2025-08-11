import { memo, useMemo } from "react";

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

interface TileSize {
  cols: number;
  rows: number;
}

// Pure function to calculate tile size based on text length
function calculateTileSize(text: string, seed: number): TileSize {
  const length = text.length;
  
  // Use seed for deterministic "randomness" based on item properties
  const variant = seed % 10;
  
  if (length > 180) {
    // Very long text: large tiles
    if (variant < 3) return { cols: 2, rows: 2 };
    if (variant < 6) return { cols: 3, rows: 1 };
    return { cols: 2, rows: 1 };
  } else if (length > 100) {
    // Long text: medium-large tiles
    if (variant < 3) return { cols: 2, rows: 1 };
    if (variant < 5) return { cols: 1, rows: 2 };
    if (variant < 7) return { cols: 2, rows: 2 };
    return { cols: 1, rows: 1 };
  } else if (length > 50) {
    // Medium text: varied tiles
    if (variant < 2) return { cols: 2, rows: 1 };
    if (variant < 3) return { cols: 1, rows: 2 };
    return { cols: 1, rows: 1 };
  } else if (length < 15) {
    // Very short text: always small
    return { cols: 1, rows: 1 };
  } else {
    // Short to medium text: mostly standard, some variation
    if (variant < 1) return { cols: 2, rows: 1 };
    return { cols: 1, rows: 1 };
  }
}

// Pure presentational component with creative masonry layout
export const GameBoard = memo(
  ({
    items,
    markedPositions,
    gridSize: _gridSize, // Kept for API compatibility, but layout is now dynamic
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

    // Pre-calculate tile sizes for consistent layout
    const tileSizes = useMemo(() => {
      return items.map((item, index) => {
        // Use combination of text content and position for seed
        const seed = item.text.charCodeAt(0) + 
                    item.text.charCodeAt(Math.floor(item.text.length / 2)) +
                    (item.text.charCodeAt(item.text.length - 1) || 0) +
                    index;
        
        return calculateTileSize(item.text, seed);
      });
    }, [items]);

    // Determine base grid columns for responsive design
    const getGridColumns = () => {
      // Use 6 columns on desktop for maximum flexibility
      // This allows for 1x1, 2x1, 3x1, 2x2, etc combinations
      return 'repeat(6, 1fr)';
    };

    return (
      <div
        className={`grid gap-3 p-4 w-full max-w-6xl mx-auto`}
        style={{ 
          gridTemplateColumns: getGridColumns(),
          gridAutoRows: 'minmax(90px, auto)',
          gridAutoFlow: 'dense'
        }}
      >
        {items.map((item, index) => {
          const isMarked = markedPositions.includes(index);
          const textLength = item.text.length;
          const tileSize = tileSizes[index];
          
          // Calculate appropriate padding based on tile size and text length
          const getPadding = () => {
            const isLargeTile = tileSize.cols > 1 && tileSize.rows > 1;
            if (isLargeTile) return 'p-6 md:p-8';
            if (tileSize.cols > 1 || tileSize.rows > 1) return 'p-4 md:p-5';
            if (textLength < 20) return 'p-4';
            if (textLength < 50) return 'p-3';
            return 'p-2.5';
          };

          // Dynamic font size based on text length and tile size
          const getFontSize = () => {
            const isLargeTile = tileSize.cols > 1 && tileSize.rows > 1;
            const isWideTile = tileSize.cols > 2;
            
            if (isLargeTile && textLength < 50) return '1.375rem';
            if (isLargeTile || isWideTile) return '1.125rem';
            if (tileSize.cols > 1 || tileSize.rows > 1) return '1.0625rem';
            if (textLength > 150) return '0.875rem';
            if (textLength > 80) return '0.9375rem';
            return '1rem';
          };

          return (
            <button
              key={`${item.id}-${index}`}
              onClick={() => handleClick(index)}
              className={`
              ${getPadding()} rounded-xl font-medium
              transition-all transform active:scale-95
              min-h-[90px] w-full h-full
              flex items-center justify-center text-center
              break-words hyphens-auto
              relative overflow-hidden
              ${
                isMarked
                  ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-xl scale-[1.02] hover:scale-105"
                  : "bg-white text-gray-800 shadow-md border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg"
              }
            `}
              style={{
                animation: isMarked ? "pop 0.3s ease-out" : undefined,
                gridColumn: `span ${tileSize.cols}`,
                gridRow: `span ${tileSize.rows}`,
                fontSize: getFontSize(),
                lineHeight: textLength > 100 ? '1.4' : '1.5',
              }}
            >
              <span className="max-w-full overflow-wrap-anywhere relative z-10">
                {item.text}
              </span>
              {/* Add subtle pattern for large tiles */}
              {(tileSize.cols > 1 || tileSize.rows > 1) && !isMarked && (
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-transparent" />
                </div>
              )}
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
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        
        @media (min-width: 768px) and (max-width: 1023px) {
          .grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
        
        @media (min-width: 1280px) {
          .grid {
            grid-template-columns: repeat(8, 1fr) !important;
          }
        }
      `}</style>
      </div>
    );
  },
);
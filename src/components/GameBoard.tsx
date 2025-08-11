import { memo, useMemo } from "react";
import type { BingoItem } from "../types/types";

interface GameBoardProps {
  items: readonly BingoItem[];
  markedPositions: readonly number[];
  gridSize: number;
  onItemClick: (position: number) => void;
  enableHaptic?: boolean;
  currentPlayerId?: string;
  currentPlayerName?: string;
}

interface TileSize {
  cols: number;
  rows: number;
}

// Pure function to calculate tile size based on text length
function calculateTileSize(text: string | undefined, seed: number): TileSize {
  const length = text?.length || 0;
  
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
        // Handle items without text
        if (!item?.text) {
          return { cols: 1, rows: 1 };
        }
        
        // Use combination of text content and position for seed
        const textToUse = item.text || "";
        const seed = textToUse.charCodeAt(0) + 
                    textToUse.charCodeAt(Math.floor(textToUse.length / 2)) +
                    (textToUse.charCodeAt(textToUse.length - 1) || 0) +
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
          const isMarkedByMe = markedPositions.includes(item.position);
          const markedBy = item.markedBy || [];
          const isMarkedByAnyone = markedBy.length > 0;
          const textLength = item.text?.length || 0;
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

          // Get initials for display
          const getInitials = (name: string) => {
            return name
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
          };

          return (
            <button
              key={`${item.id}-${index}`}
              onClick={() => handleClick(item.position)}
              className={`
              ${getPadding()} rounded-xl font-medium
              transition-all transform active:scale-95
              min-h-[90px] w-full h-full
              flex flex-col items-center justify-center text-center
              break-words hyphens-auto
              relative overflow-hidden
              ${
                isMarkedByMe
                  ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-xl scale-[1.02] hover:scale-105"
                  : isMarkedByAnyone
                  ? "bg-gradient-to-br from-blue-400 to-cyan-400 text-white shadow-lg hover:scale-105"
                  : "bg-white text-gray-800 shadow-md border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg"
              }
            `}
              style={{
                animation: isMarkedByAnyone ? "pop 0.3s ease-out" : undefined,
                gridColumn: `span ${tileSize.cols}`,
                gridRow: `span ${tileSize.rows}`,
                fontSize: getFontSize(),
                lineHeight: textLength > 100 ? '1.4' : '1.5',
              }}
            >
              <span className="max-w-full overflow-wrap-anywhere relative z-10">
                {item.text || "(empty)"}
              </span>
              
              {/* Show who marked this square */}
              {markedBy.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 justify-center">
                  {markedBy.slice(0, 3).map((mark, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold"
                      title={`${mark.displayName} - ${new Date(mark.markedAt).toLocaleString()}`}
                    >
                      {getInitials(mark.displayName)}
                    </span>
                  ))}
                  {markedBy.length > 3 && (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold">
                      +{markedBy.length - 3}
                    </span>
                  )}
                </div>
              )}
              
              {/* Add "Also saw this!" indicator if marked by others but not me */}
              {isMarkedByAnyone && !isMarkedByMe && (
                <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 rounded-full p-1" title="Also saw this!">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                  </svg>
                </div>
              )}
              
              {/* Add subtle pattern for large tiles */}
              {(tileSize.cols > 1 || tileSize.rows > 1) && !isMarkedByAnyone && (
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
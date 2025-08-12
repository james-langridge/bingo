import { memo, useMemo } from "react";
import type { BingoItem } from "../types/types";
import { UI_CONFIG } from "../lib/constants";

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

function calculateTileSize(text: string | undefined, seed: number): TileSize {
  const length = text?.length || 0;
  
  const variant = seed % 10;
  
  if (length > 180) {
    if (variant < 3) return { cols: 2, rows: 2 };
    if (variant < 6) return { cols: 3, rows: 1 };
    return { cols: 2, rows: 1 };
  } else if (length > 100) {
    if (variant < 3) return { cols: 2, rows: 1 };
    if (variant < 5) return { cols: 1, rows: 2 };
    if (variant < 7) return { cols: 2, rows: 2 };
    return { cols: 1, rows: 1 };
  } else if (length > 50) {
    if (variant < 2) return { cols: 2, rows: 1 };
    if (variant < 3) return { cols: 1, rows: 2 };
    return { cols: 1, rows: 1 };
  } else if (length < 15) {
    return { cols: 1, rows: 1 };
  } else {
    if (variant < 1) return { cols: 2, rows: 1 };
    return { cols: 1, rows: 1 };
  }
}

export const GameBoard = memo(
  ({
    items,
    markedPositions,
    gridSize: _gridSize, // Kept for API compatibility, but layout is now dynamic
    onItemClick,
    enableHaptic = true,
    currentPlayerId,
  }: GameBoardProps) => {
    const handleClick = (position: number) => {
      if (enableHaptic && "vibrate" in navigator) {
        navigator.vibrate(UI_CONFIG.HAPTIC_DURATION);
      }
      onItemClick(position);
    };

    const tileSizes = useMemo(() => {
      return items.map((item, index) => {
        if (!item?.text) {
          return { cols: 1, rows: 1 };
        }
        
        const textToUse = item.text || "";
        const seed = textToUse.charCodeAt(0) + 
                    textToUse.charCodeAt(Math.floor(textToUse.length / 2)) +
                    (textToUse.charCodeAt(textToUse.length - 1) || 0) +
                    index;
        
        return calculateTileSize(item.text, seed);
      });
    }, [items]);

    const getGridColumns = () => {
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
          const markedByOthers = currentPlayerId 
            ? markedBy.filter(mark => mark.playerId !== currentPlayerId)
            : markedBy;
          const isMarkedByAnyone = markedBy.length > 0;
          const textLength = item.text?.length || 0;
          const tileSize = tileSizes[index];
          
          const getPadding = () => {
            const isLargeTile = tileSize.cols > 1 && tileSize.rows > 1;
            if (isLargeTile) return 'p-6 md:p-8';
            if (tileSize.cols > 1 || tileSize.rows > 1) return 'p-4 md:p-5';
            if (textLength < 20) return 'p-4';
            if (textLength < 50) return 'p-3';
            return 'p-2.5';
          };

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
              
              {/* Show who marked this square (excluding current player) */}
              {markedByOthers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 justify-center">
                  {markedByOthers.slice(0, 3).map((mark, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold"
                      title={`${mark.displayName} - ${new Date(mark.markedAt).toLocaleString()}`}
                    >
                      {getInitials(mark.displayName)}
                    </span>
                  ))}
                  {markedByOthers.length > 3 && (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold">
                      +{markedByOthers.length - 3}
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
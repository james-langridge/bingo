import { memo } from "react";
import type { BingoItem } from "../../types/types";
import type { TileSize } from "../../lib/gameboard/calculations";
import { 
  getTilePadding, 
  getTileFontSize, 
  getTileLineHeight, 
  getTileClasses,
  getInitials 
} from "../../lib/gameboard/calculations";
import { UI_CONFIG } from "../../lib/constants";

interface BingoTileProps {
  item: BingoItem;
  tileSize: TileSize;
  isMarkedByMe: boolean;
  markedByOthers: readonly {
    playerId: string;
    displayName: string;
    markedAt: string;
  }[];
  onClick: () => void;
  enableHaptic?: boolean;
}

export const BingoTile = memo(({
  item,
  tileSize,
  isMarkedByMe,
  markedByOthers,
  onClick,
  enableHaptic = true,
}: BingoTileProps) => {
  const textLength = item.text?.length || 0;
  const isMarkedByAnyone = (item.markedBy?.length || 0) > 0;
  
  const handleClick = () => {
    if (enableHaptic && "vibrate" in navigator) {
      navigator.vibrate(UI_CONFIG.HAPTIC_DURATION);
    }
    onClick();
  };
  
  const padding = getTilePadding(tileSize, textLength);
  const fontSize = getTileFontSize(tileSize, textLength);
  const lineHeight = getTileLineHeight(textLength);
  const classes = getTileClasses(isMarkedByMe, isMarkedByAnyone);
  
  return (
    <button
      onClick={handleClick}
      className={`${padding} ${classes}`}
      style={{
        animation: isMarkedByAnyone ? "pop 0.3s ease-out" : undefined,
        gridColumn: `span ${tileSize.cols}`,
        gridRow: `span ${tileSize.rows}`,
        fontSize,
        lineHeight,
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
});

BingoTile.displayName = 'BingoTile';
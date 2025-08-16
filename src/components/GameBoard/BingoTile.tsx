import { memo } from "react";
import type { BingoItem } from "../../types/types";
import {
  getTilePadding,
  getTileFontSize,
  getTileLineHeight,
  getTileClasses,
} from "../../lib/gameboard/calculations";
import { UI_CONFIG } from "../../lib/constants";

interface BingoTileProps {
  item: BingoItem;
  count: number;
  onClick: () => void;
  enableHaptic?: boolean;
}

export const BingoTile = memo(
  ({ item, count, onClick, enableHaptic = true }: BingoTileProps) => {
    const textLength = item.text?.length || 0;
    const isMarked = count > 0;

    const handleClick = () => {
      if (enableHaptic && "vibrate" in navigator) {
        navigator.vibrate(UI_CONFIG.HAPTIC_DURATION);
      }
      onClick();
    };

    const padding = getTilePadding(textLength);
    const fontSize = getTileFontSize(textLength);
    const lineHeight = getTileLineHeight(textLength);
    const classes = getTileClasses(isMarked, false);

    return (
      <button
        onClick={handleClick}
        className={`${padding} ${classes}`}
        style={{
          animation: isMarked ? "pop 0.3s ease-out" : undefined,
          fontSize,
          lineHeight,
        }}
      >
        <span className="flex-1 px-1 relative z-10">
          {item.text || "(empty)"}
        </span>

        {/* Show count if greater than zero */}
        {count > 0 && (
          <div className="flex items-center justify-center bg-green-500 text-white rounded-full min-w-[28px] h-7 px-2 mr-2 font-bold text-sm">
            {count}
          </div>
        )}
      </button>
    );
  },
);

BingoTile.displayName = "BingoTile";

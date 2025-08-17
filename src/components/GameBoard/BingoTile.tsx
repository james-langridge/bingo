import { memo } from "react";
import type { BingoItem, Player } from "../../types/types";
import {
  getTileFontSize,
  getTileLineHeight,
  getTileClasses,
} from "../../lib/gameboard/calculations";
import { UI_CONFIG } from "../../lib/constants";
import { getPlayerColor } from "../../lib/playerColors";

interface PlayerCount {
  player: Player;
  count: number;
  playerIndex: number;
}

interface BingoTileProps {
  item: BingoItem;
  count: number;
  onClick: () => void;
  enableHaptic?: boolean;
  playerCounts?: PlayerCount[]; // Other players' counts for this item
}

export const BingoTile = memo(
  ({
    item,
    count,
    onClick,
    enableHaptic = true,
    playerCounts = [],
  }: BingoTileProps) => {
    const textLength = item.text?.length || 0;
    const isMarked = count > 0;

    const handleClick = () => {
      if (enableHaptic && "vibrate" in navigator) {
        navigator.vibrate(UI_CONFIG.HAPTIC_DURATION);
      }
      onClick();
    };

    const fontSize = getTileFontSize(textLength);
    const lineHeight = getTileLineHeight(textLength);
    const classes = getTileClasses(isMarked, false);

    return (
      <button
        onClick={handleClick}
        className={`${classes} relative flex flex-col`}
        style={{
          animation: isMarked ? "pop 0.3s ease-out" : undefined,
          padding: "0.75rem",
        }}
      >
        {/* Text content */}
        <div
          className="flex-1 flex items-center justify-center text-center"
          style={{
            fontSize,
            lineHeight,
          }}
        >
          {item.text || "(empty)"}
        </div>

        {/* Player indicators in bottom left below text */}
        {(count > 0 || playerCounts.length > 0) && (
          <div className="flex gap-1 flex-wrap mt-2">
            {/* Current player's count (green) */}
            {count > 0 && (
              <div className="flex items-center justify-center bg-green-500 text-white rounded-full w-7 h-7 text-xs font-bold">
                {count}
              </div>
            )}

            {/* Other players' indicators */}
            {playerCounts.map(({ player, count: playerCount, playerIndex }) => (
              <div
                key={player.id}
                className="flex items-center justify-center text-white rounded-full w-7 h-7 text-xs font-bold"
                style={{ backgroundColor: getPlayerColor(playerIndex) }}
                title={`${player.displayName}: ${playerCount}`}
              >
                {playerCount}
              </div>
            ))}
          </div>
        )}
      </button>
    );
  },
);

BingoTile.displayName = "BingoTile";

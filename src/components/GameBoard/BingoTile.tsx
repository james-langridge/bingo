import { memo } from "react";
import type { BingoItem, Player } from "../../types/types";
import {
  getTilePadding,
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

    const padding = getTilePadding(textLength);
    const fontSize = getTileFontSize(textLength);
    const lineHeight = getTileLineHeight(textLength);
    const classes = getTileClasses(isMarked, false);

    return (
      <button
        onClick={handleClick}
        className={`${padding} ${classes} relative`}
        style={{
          animation: isMarked ? "pop 0.3s ease-out" : undefined,
          fontSize,
          lineHeight,
        }}
      >
        <span className="flex-1 px-1 relative z-10">
          {item.text || "(empty)"}
        </span>

        {/* Show current player's count */}
        {count > 0 && (
          <div className="flex items-center justify-center bg-green-500 text-white rounded-full min-w-[28px] h-7 px-2 mr-2 font-bold text-sm">
            {count}
          </div>
        )}

        {/* Show other players' indicators in bottom left */}
        {playerCounts.length > 0 && (
          <div className="absolute bottom-1 left-1 flex gap-1 flex-wrap max-w-[calc(100%-8px)]">
            {playerCounts.map(({ player, count: playerCount, playerIndex }) => (
              <div
                key={player.id}
                className="flex items-center justify-center text-white rounded-full w-6 h-6 text-xs font-bold"
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

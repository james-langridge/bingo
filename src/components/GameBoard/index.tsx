import { memo } from "react";
import type { BingoItem, Player, PlayerItemCounts } from "../../types/types";
import { BingoTile } from "./BingoTile";

// Must match the type in BingoTile
interface PlayerCount {
  player: Player;
  count: number;
  playerIndex: number;
}

interface GameBoardProps {
  items: readonly BingoItem[];
  itemCounts: Record<number, number>;
  gridSize: number;
  onItemClick: (position: number) => void;
  enableHaptic?: boolean;
  players?: readonly Player[];
  allPlayerCounts?: PlayerItemCounts[];
  currentPlayerName?: string;
}

export const GameBoard = memo(
  ({
    items,
    itemCounts,
    gridSize: _gridSize, // Kept for API compatibility
    onItemClick,
    enableHaptic = true,
    players = [],
    allPlayerCounts = [],
    currentPlayerName,
  }: GameBoardProps) => {
    return (
      <>
        <div className="flex flex-col gap-1.5 p-1 w-full max-w-2xl mx-auto">
          {items.map((item, index) => {
            const count = itemCounts[item.position] || 0;

            // Get other players' counts for this position
            const playerCounts = allPlayerCounts
              .filter(
                (pc) =>
                  pc.displayName !== currentPlayerName &&
                  pc.itemCounts[item.position] > 0,
              )
              .map((pc) => {
                const playerIndex = players.findIndex(
                  (p) => p.id === pc.playerId,
                );
                const player = players[playerIndex];
                return player
                  ? {
                      player,
                      count: pc.itemCounts[item.position],
                      playerIndex,
                    }
                  : null;
              })
              .filter(Boolean) as PlayerCount[];

            return (
              <BingoTile
                key={`${item.id}-${index}`}
                item={item}
                count={count}
                onClick={() => onItemClick(item.position)}
                enableHaptic={enableHaptic}
                playerCounts={playerCounts}
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

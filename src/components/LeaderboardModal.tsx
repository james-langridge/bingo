import { useMemo, useEffect, useState } from "react";
import type { Player, BingoItem, PlayerState } from "../types/types";

interface PlayerWithCounts extends Player {
  itemCounts: Record<string, number>;
  total: number;
}

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: readonly Player[];
  items: readonly BingoItem[];
  currentPlayerState: PlayerState | null;
  gameCode: string;
}

export function LeaderboardModal({
  isOpen,
  onClose,
  players,
  items,
  currentPlayerState,
  gameCode,
}: LeaderboardModalProps) {
  const [playersData, setPlayersData] = useState<PlayerWithCounts[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading true for initial load
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Reset hasInitialLoad when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasInitialLoad(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPlayerCounts = async (isBackgroundRefresh = false) => {
      // Only show loading on initial load, not on background refreshes
      if (!isBackgroundRefresh && !hasInitialLoad) {
        setLoading(true);
      }

      try {
        // Fetch counts for all players
        const response = await fetch(`/api/game/${gameCode}/leaderboard`);

        if (response.ok) {
          const data = await response.json();
          setPlayersData(data.players || []);
        } else {
          // If endpoint doesn't exist, show only current player's data
          const currentPlayerData = players.map((player) => {
            if (
              currentPlayerState &&
              player.displayName === currentPlayerState.displayName
            ) {
              // Convert position-based counts to item-text-based counts
              const textCounts: Record<string, number> = {};
              let total = 0;

              Object.entries(currentPlayerState.itemCounts).forEach(
                ([position, count]) => {
                  const item = items.find(
                    (i) => i.position === parseInt(position),
                  );
                  if (item) {
                    textCounts[item.text] = count;
                    total += count;
                  }
                },
              );

              return {
                ...player,
                itemCounts: textCounts,
                total,
              };
            }
            return {
              ...player,
              itemCounts: {},
              total: 0,
            };
          });
          setPlayersData(currentPlayerData);
        }
      } catch (error) {
        // Fallback to showing only current player
        console.error("Failed to fetch leaderboard data:", error);
        const currentPlayerData = players.map((player) => {
          if (
            currentPlayerState &&
            player.displayName === currentPlayerState.displayName
          ) {
            const textCounts: Record<string, number> = {};
            let total = 0;

            Object.entries(currentPlayerState.itemCounts).forEach(
              ([position, count]) => {
                const item = items.find(
                  (i) => i.position === parseInt(position),
                );
                if (item) {
                  textCounts[item.text] = count;
                  total += count;
                }
              },
            );

            return {
              ...player,
              itemCounts: textCounts,
              total,
            };
          }
          return {
            ...player,
            itemCounts: {},
            total: 0,
          };
        });
        setPlayersData(currentPlayerData);
      }
      // Only set loading false after initial load
      if (!isBackgroundRefresh) {
        setLoading(false);
        setHasInitialLoad(true);
      }
    };

    // Initial load
    if (!hasInitialLoad) {
      fetchPlayerCounts(false);
    }

    // Set up interval for background refresh (every 5 seconds)
    const interval = setInterval(() => {
      fetchPlayerCounts(true); // Background refresh
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, gameCode, currentPlayerState]); // Re-run when modal opens or state changes

  if (!isOpen) return null;

  // Sort by total count descending
  const leaderboardData = useMemo(() => {
    return [...playersData].sort((a, b) => b.total - a.total);
  }, [playersData]);

  // Get all unique items that have been counted by any player
  const activeItems = useMemo(() => {
    const itemSet = new Set<string>();
    playersData.forEach((player) => {
      Object.entries(player.itemCounts).forEach(([item, count]) => {
        if (count > 0) {
          itemSet.add(item);
        }
      });
    });
    return Array.from(itemSet).sort();
  }, [playersData]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-bold">Leaderboard</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-auto max-h-[calc(80vh-8rem)]">
            {loading ? (
              <p className="text-center text-gray-500 py-8">
                Loading leaderboard...
              </p>
            ) : leaderboardData.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No players have joined yet
              </p>
            ) : activeItems.length === 0 ? (
              // Show simple player list when no items counted yet
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-4">
                  No items have been counted yet. Start counting to see the
                  leaderboard!
                </p>
                <div className="space-y-1">
                  {leaderboardData.map((player) => {
                    const isOnline =
                      Date.now() - (player.lastSeenAt || 0) < 15000;
                    return (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div className="flex items-center">
                          {isOnline && (
                            <span
                              className="w-2 h-2 bg-green-500 rounded-full mr-2"
                              title="Online now"
                            />
                          )}
                          <span className="font-medium">
                            {player.displayName}
                          </span>
                        </div>
                        <span className="text-gray-500">0 items</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left p-2 font-semibold sticky left-0 bg-white">
                        Player
                      </th>
                      {activeItems.map((item) => (
                        <th
                          key={item}
                          className="text-center p-2 font-semibold min-w-[60px]"
                        >
                          <div className="text-xs break-words" title={item}>
                            {item.length > 15
                              ? `${item.substring(0, 15)}...`
                              : item}
                          </div>
                        </th>
                      ))}
                      <th className="text-center p-2 font-semibold bg-gray-50">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.map((player, index) => {
                      const isOnline =
                        Date.now() - (player.lastSeenAt || 0) < 15000;
                      return (
                        <tr
                          key={player.id}
                          className={`border-b border-gray-200 ${
                            index === 0 && player.total > 0
                              ? "bg-yellow-50"
                              : ""
                          }`}
                        >
                          <td className="p-2 font-medium sticky left-0 bg-white">
                            <div className="flex items-center">
                              {isOnline && (
                                <span
                                  className="w-2 h-2 bg-green-500 rounded-full mr-2"
                                  title="Online now"
                                />
                              )}
                              <span>
                                {player.displayName}
                                {index === 0 && player.total > 0 && " 👑"}
                              </span>
                            </div>
                          </td>
                          {activeItems.map((item) => (
                            <td key={item} className="text-center p-2">
                              <span
                                className={`${
                                  player.itemCounts[item] > 0
                                    ? "font-semibold text-blue-600"
                                    : "text-gray-400"
                                }`}
                              >
                                {player.itemCounts[item] || 0}
                              </span>
                            </td>
                          ))}
                          <td className="text-center p-2 font-bold bg-gray-50">
                            {player.total}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

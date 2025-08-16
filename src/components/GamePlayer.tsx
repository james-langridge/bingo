import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGameStore } from "../stores/gameStore";
import { GameBoard } from "./GameBoard";
import { Celebration } from "./Celebration";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ErrorBoundary } from "./ErrorBoundary";
import { WinnerNotification } from "./WinnerNotification";
import { shuffleItems } from "../lib/calculations";
import { getSyncManager } from "../lib/syncManager";

export function GamePlayer() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const {
    currentGame,
    playerState,
    currentPlayerId,
    loadGame,
    joinGame,
    markPosition,
  } = useGameStore();
  const [displayName, setDisplayName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deterministic shuffle - always call this hook, even if we don't use the result yet
  const shuffledItems = useMemo(() => {
    if (!currentGame || !playerState) return [];
    const seed = `${currentGame.gameCode}-${playerState.displayName}`;
    return shuffleItems(currentGame.items, seed);
  }, [currentGame, playerState]);

  useEffect(() => {
    const initGame = async () => {
      if (!code) {
        setError("Invalid game code");
        setIsLoading(false);
        return;
      }

      try {
        await loadGame(code);
        setIsLoading(false);
      } catch {
        setError("Game not found");
        setIsLoading(false);
      }
    };

    initGame();
  }, [code, loadGame]);

  useEffect(() => {
    console.log({ currentGame });
  }, [currentGame]);

  // Log winner changes for debugging
  useEffect(() => {
    if (currentGame?.winner) {
      console.log("[GamePlayer] Winner detected:", {
        winnerName: currentGame.winner.displayName,
        isCurrentPlayer: currentGame.winner.playerId === currentPlayerId,
        wonAt: new Date(currentGame.winner.wonAt).toLocaleTimeString(),
      });
    }
  }, [currentGame?.winner, playerState?.displayName]);

  // Send heartbeat to keep player marked as online (pause when tab hidden)
  useEffect(() => {
    if (!currentGame || !playerState || !currentPlayerId) return;

    let heartbeatInterval: NodeJS.Timeout | null = null;

    const sendHeartbeat = async () => {
      // Don't send heartbeat if tab is hidden
      if (document.hidden) {
        console.log("[GamePlayer] Tab hidden, skipping heartbeat");
        return;
      }

      try {
        // Send heartbeat to dedicated endpoint
        await fetch(`/api/player/${currentGame.gameCode}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: currentPlayerId }),
        });

        console.log("[GamePlayer] Sent heartbeat to keep player online");
      } catch (error) {
        console.error("[GamePlayer] Failed to send heartbeat:", error);
      }
    };

    const startHeartbeat = () => {
      // Send initial heartbeat
      sendHeartbeat();

      // Clear any existing interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      // Send heartbeat every 10 seconds (well under the 15 second timeout)
      heartbeatInterval = setInterval(sendHeartbeat, 10000);
      console.log("[GamePlayer] Started heartbeat interval");
    };

    const stopHeartbeat = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        console.log("[GamePlayer] Stopped heartbeat interval");
      }
    };

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - stop heartbeat
        console.log("[GamePlayer] Tab hidden - stopping heartbeat");
        stopHeartbeat();
      } else {
        // Tab is visible - restart heartbeat
        console.log("[GamePlayer] Tab visible - restarting heartbeat");
        startHeartbeat();
      }
    };

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Start heartbeat if tab is currently visible
    if (!document.hidden) {
      startHeartbeat();
    }

    return () => {
      stopHeartbeat();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentGame?.gameCode, currentPlayerId]);

  // Cleanup SSE connection when leaving the game page
  useEffect(() => {
    return () => {
      const syncManager = getSyncManager();
      syncManager.disconnect();
      console.log("[GamePlayer] Cleaned up SSE connection on unmount");
    };
  }, []);

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !code) return;

    setIsJoining(true);
    try {
      await joinGame(code, displayName.trim());
    } catch {
      setError("Failed to join game");
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton type="board" />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <div className="text-xl text-red-600 mb-4">{error}</div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (!currentGame) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <div className="text-xl mb-4">Game not found</div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Go Home
        </button>
      </div>
    );
  }

  // Show join form if not yet joined
  if (!playerState) {
    return (
      <div className="min-h-screen bg-gray-100 py-4">
        <div className="container mx-auto px-3 max-w-md">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold mb-2">{currentGame.title}</h1>
            <p className="text-gray-600 mb-6">
              Game Code: <span className="font-mono font-bold">{code}</span>
            </p>

            {/* Show players list */}
            {currentGame.players.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Players already in this game ({currentGame.players.length}):
                </h3>
                <div className="space-y-1">
                  {currentGame.players.map((player) => {
                    // Calculate if player is online (lastSeenAt within 15 seconds)
                    const isOnline =
                      Date.now() - (player.lastSeenAt || 0) < 15000;

                    return (
                      <div
                        key={player.id}
                        className="text-sm text-gray-600 flex items-center"
                      >
                        • {player.displayName}
                        {player.hasWon && (
                          <span className="ml-2 text-green-600 font-semibold">
                            🏆 Winner!
                          </span>
                        )}
                        {isOnline && (
                          <span
                            className="ml-2 w-2 h-2 bg-green-500 rounded-full inline-block"
                            title="Online now"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Tip: If you played before, use the same name to continue your
                  game!
                </p>
              </div>
            )}

            <form onSubmit={handleJoinGame} className="space-y-4">
              <input
                type="text"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                maxLength={50}
              />
              <button
                type="submit"
                disabled={isJoining || !displayName.trim()}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isJoining ? "Joining..." : "Join Game"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Check if there are enough items for the game
  if (currentGame.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 py-4">
        <div className="container mx-auto px-3 max-w-lg">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <h1 className="text-2xl font-bold mb-2">{currentGame.title}</h1>
            <p className="text-gray-600 mb-4">
              Game Code: <span className="font-mono font-bold">{code}</span>
            </p>
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <p className="text-lg">Waiting for game to be set up...</p>
              <p className="text-sm text-gray-600 mt-2">
                The game organizer needs to add bingo items before you can play.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasWon =
    playerState && currentGame.items
      ? playerState.markedPositions.length === currentGame.items.length
      : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 py-4 relative">
      <div className="container mx-auto px-2 max-w-4xl">
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 px-2">
            <div>
              <h1 className="text-2xl font-bold">{currentGame.title}</h1>
              <p className="text-gray-600">
                Game Code: <span className="font-mono font-bold">{code}</span>
              </p>
            </div>
            <div className="flex gap-2 mt-2 sm:mt-0">
              <button
                onClick={() => navigate("/")}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Home
              </button>
            </div>
          </div>

          {/* Players list sidebar */}
          <div className="mb-3 p-2 bg-gray-50 rounded-lg mx-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-700">Players</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
              {currentGame.players.map((player) => {
                // Calculate if player is online (lastSeenAt within 15 seconds)
                const isOnline = Date.now() - (player.lastSeenAt || 0) < 15000;

                return (
                  <div
                    key={player.id}
                    className={`text-sm px-2 py-1 rounded ${
                      player.displayName === playerState?.displayName
                        ? "bg-blue-100 text-blue-700 font-semibold"
                        : "bg-white text-gray-600"
                    } ${player.hasWon ? "border-2 border-green-500" : ""}`}
                  >
                    <div className="flex items-center">
                      {player.hasWon && <span className="mr-1">🏆</span>}
                      {isOnline && (
                        <span
                          className="w-2 h-2 bg-green-500 rounded-full mr-1"
                          title="Online now"
                        />
                      )}
                      <span className="truncate">{player.displayName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Persistent winner notification */}
          {currentGame.winner && (
            <WinnerNotification
              winnerName={currentGame.winner.displayName}
              isCurrentPlayer={currentGame.winner.playerId === currentPlayerId}
            />
          )}

          <ErrorBoundary
            context="GameBoard"
            fallback={(_error, reset) => (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600 font-medium mb-4">
                  Unable to display the game board
                </p>
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Try Again
                </button>
              </div>
            )}
          >
            <GameBoard
              items={shuffledItems}
              markedPositions={playerState?.markedPositions || []}
              onItemClick={markPosition}
              gridSize={currentGame.settings?.gridSize || 5}
              currentPlayerId={currentPlayerId || undefined}
              currentPlayerName={playerState?.displayName}
            />
          </ErrorBoundary>
        </div>
      </div>

      {hasWon && <Celebration />}
    </div>
  );
}

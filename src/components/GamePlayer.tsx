import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGameStore } from "../stores/gameStore";
import { GameBoard } from "./GameBoard";
import { Celebration } from "./Celebration";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { checkWinCondition, shuffleItems } from "../lib/calculations";

export function GamePlayer() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const {
    currentGame,
    playerState,
    loadGame,
    joinGame,
    markPosition,
    clearMarkedPositions,
    stopPolling,
    refreshGameState,
  } = useGameStore();
  const [displayName, setDisplayName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWinnerNotification, setShowWinnerNotification] = useState(false);

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

  // Check for new winner
  useEffect(() => {
    if (currentGame?.winner) {
      // Show notification if someone else won
      if (currentGame.winner.displayName !== playerState?.displayName) {
        setShowWinnerNotification(true);
        setTimeout(() => setShowWinnerNotification(false), 10000); // Show for 10 seconds
      }
    }
  }, [
    currentGame?.winner?.wonAt,
    currentGame?.winner?.displayName,
    playerState?.displayName,
  ]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const handleRefresh = useCallback(async () => {
    if (!code) return;
    setIsRefreshing(true);
    await refreshGameState();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [code, refreshGameState]);

  const { containerRef, isPulling, pullDistance } =
    usePullToRefresh(handleRefresh);

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
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4 max-w-md">
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
                  {currentGame.players.map((player) => (
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
                      {player.isOnline && (
                        <span
                          className="ml-2 w-2 h-2 bg-green-500 rounded-full inline-block"
                          title="Online now"
                        />
                      )}
                    </div>
                  ))}
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
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4 max-w-lg">
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

  const hasWon = playerState
    ? checkWinCondition(
        playerState.markedPositions,
        currentGame.settings.gridSize,
        currentGame.settings.requireFullCard,
      )
    : false;

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 py-8 relative"
      style={{
        transform: isPulling
          ? `translateY(${pullDistance}px)`
          : "translateY(0)",
        transition: isPulling ? "none" : "transform 0.3s ease-out",
      }}
    >
      {/* Pull to refresh indicator */}
      {isPulling && (
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-2">
          <div className="bg-white rounded-full p-2 shadow-lg">
            <svg
              className="w-6 h-6 text-gray-600 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Winner notification banner */}
      {showWinnerNotification && currentGame.winner && (
        <div className="fixed top-4 left-4 right-4 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4 rounded-lg shadow-lg">
            <div className="flex items-center justify-center">
              <span className="text-2xl mr-2">🎉</span>
              <span className="font-bold text-lg">
                {currentGame.winner.displayName} has won the game!
              </span>
              <span className="text-2xl ml-2">🏆</span>
            </div>
          </div>
        </div>
      )}

      {isRefreshing && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="text-lg font-semibold">Refreshing...</div>
        </div>
      )}

      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold">{currentGame.title}</h1>
              <p className="text-gray-600">
                Game Code: <span className="font-mono font-bold">{code}</span>
              </p>
              <p className="text-sm text-gray-500">
                Playing as:{" "}
                <span className="font-semibold">
                  {playerState?.displayName}
                </span>
              </p>
            </div>
            <button
              onClick={clearMarkedPositions}
              className="mt-3 sm:mt-0 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Clear Board
            </button>
          </div>

          {/* Players list sidebar */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Players in Game ({currentGame.players.length})
              </h3>
              <span className="text-xs text-gray-500">
                Updates every 2 seconds
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {currentGame.players.map((player) => (
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
                    {player.isOnline && (
                      <span
                        className="w-2 h-2 bg-green-500 rounded-full mr-1"
                        title="Online now"
                      />
                    )}
                    <span className="truncate">{player.displayName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <GameBoard
            items={shuffledItems}
            markedPositions={playerState?.markedPositions || []}
            onItemClick={markPosition}
            gridSize={currentGame.settings.gridSize}
          />

          {currentGame.settings.requireFullCard ? (
            <p className="text-center text-sm text-gray-600 mt-4">
              Win condition: Mark all squares
            </p>
          ) : (
            <p className="text-center text-sm text-gray-600 mt-4">
              Win condition: Complete any row, column, or diagonal
            </p>
          )}
        </div>
      </div>

      {hasWon && <Celebration />}
    </div>
  );
}

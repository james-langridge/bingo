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
  } = useGameStore();
  const [displayName, setDisplayName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleRefresh = useCallback(async () => {
    if (!code) return;
    setIsRefreshing(true);
    await loadGame(code);
    setTimeout(() => setIsRefreshing(false), 500);
  }, [code, loadGame]);

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
      {(isPulling || isRefreshing) && (
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-4">
          <div className="bg-white rounded-full shadow-lg p-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent"></div>
          </div>
        </div>
      )}
      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            {currentGame.title}
          </h1>
          <p className="text-gray-600">
            Playing as: <strong>{playerState.displayName}</strong>
          </p>
          <p className="text-sm text-gray-500">
            Code: <span className="font-mono">{code}</span>
          </p>
        </div>

        {hasWon && <Celebration />}

        <GameBoard
          items={shuffledItems}
          markedPositions={playerState.markedPositions}
          gridSize={currentGame.settings.gridSize}
          onItemClick={markPosition}
        />

        <div className="flex justify-center mt-6 space-x-4">
          <button
            onClick={clearMarkedPositions}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:scale-95 transition-all"
          >
            Clear Board
          </button>
          <div className="text-gray-600 py-2">
            Marked: {playerState.markedPositions.length} /{" "}
            {currentGame.items.length}
          </div>
        </div>
      </div>
    </div>
  );
}

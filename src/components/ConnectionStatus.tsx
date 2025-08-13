import { useEffect, useState } from "react";
import { useGameStore } from "../stores/gameStore";

export function ConnectionStatus() {
  const { isConnected, playerState, currentGame } = useGameStore();
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    // Only show status briefly when connection state changes
    if (!isConnected) {
      setShowStatus(true);
    } else {
      // Hide the "connected" status after 3 seconds
      setShowStatus(true);
      const timeout = setTimeout(() => setShowStatus(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [isConnected]);

  // Only show sync status if:
  // 1. Player has joined the game (has playerState)
  // 2. Game has been started (has items)
  if (!currentGame || !playerState || currentGame.items.length === 0) {
    return null;
  }

  // Show connected status briefly after reconnection
  if (isConnected && showStatus) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-full shadow-sm transition-opacity duration-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs font-medium">Connected</span>
        </div>
      </div>
    );
  }

  // Show disconnected/reconnecting status
  if (!isConnected) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-2 bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full shadow-sm">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
          <span className="text-xs font-medium">Reconnecting...</span>
        </div>
      </div>
    );
  }

  return null;
}

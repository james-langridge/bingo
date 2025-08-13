import { useEffect, useState } from "react";
import { useGameStore } from "../stores/gameStore";

export function ConnectionStatus() {
  const { isConnected, playerState, currentGame } = useGameStore();
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [timeSinceSync, setTimeSinceSync] = useState<string>("");

  // Update time since last sync
  useEffect(() => {
    const updateTimeSinceSync = () => {
      if (!playerState?.lastSyncAt) {
        setTimeSinceSync("");
        return;
      }
      
      const seconds = Math.floor((Date.now() - playerState.lastSyncAt) / 1000);
      if (seconds < 60) {
        setTimeSinceSync(`${seconds}s ago`);
      } else {
        const minutes = Math.floor(seconds / 60);
        setTimeSinceSync(`${minutes}m ago`);
      }
    };

    updateTimeSinceSync();
    const interval = setInterval(updateTimeSinceSync, 1000);
    return () => clearInterval(interval);
  }, [playerState?.lastSyncAt]);

  useEffect(() => {
    let timeout: number;
    if (!isConnected) {
      // Show reconnecting message after 2 seconds of disconnection
      timeout = window.setTimeout(() => {
        setShowReconnecting(true);
        setReconnectAttempts((prev) => prev + 1);
      }, 2000);
    } else {
      setShowReconnecting(false);
      setReconnectAttempts(0);
    }
    return () => clearTimeout(timeout);
  }, [isConnected]);

  // Don't show if no game is loaded or game has never been synced
  if (!currentGame || (!playerState?.lastSyncAt && currentGame.items.length === 0)) {
    return null;
  }

  // Don't show anything if connected and working normally
  if (isConnected && !showReconnecting) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-full shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs font-medium">
            Synced {timeSinceSync}
          </span>
        </div>
      </div>
    );
  }

  // Show disconnected/reconnecting status
  if (!isConnected || showReconnecting) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-2 bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full shadow-sm">
          <svg
            className="w-3 h-3 animate-spin"
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
          <span className="text-xs font-medium">
            {reconnectAttempts > 3 
              ? `Offline ${timeSinceSync ? `(${timeSinceSync})` : ''}` 
              : "Reconnecting..."}
          </span>
        </div>
      </div>
    );
  }

  return null;
}
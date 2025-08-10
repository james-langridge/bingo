import { useEffect, useState } from "react";
import type { WinnerInfo } from "../types/types";

interface WinnerNotificationProps {
  winner: WinnerInfo | undefined;
  isCurrentPlayer: boolean;
}

export function WinnerNotification({
  winner,
  isCurrentPlayer,
}: WinnerNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (winner && !isCurrentPlayer) {
      setIsVisible(true);
      setIsExiting(false);

      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => setIsVisible(false), 500);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [winner, isCurrentPlayer]);

  if (!isVisible || !winner) return null;

  return (
    <div
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ${
        isExiting ? "opacity-0 scale-95" : "opacity-100 scale-100"
      }`}
    >
      <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 p-1 rounded-lg shadow-2xl">
        <div className="bg-white rounded-md p-4 sm:p-6">
          <div className="flex flex-col items-center text-center">
            <div className="text-6xl mb-3 animate-bounce">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Game Over!
            </h2>
            <p className="text-lg text-gray-700 mb-1">
              <span className="font-bold text-xl">{winner.displayName}</span>
            </p>
            <p className="text-gray-600">
              has won with a{" "}
              {winner.winType === "fullCard" ? "full card" : "line"}!
            </p>
            <div className="flex space-x-2 mt-4">
              <span className="text-3xl animate-pulse">🏆</span>
              <span className="text-3xl animate-pulse delay-100">🎊</span>
              <span className="text-3xl animate-pulse delay-200">🥳</span>
            </div>
            <button
              onClick={() => {
                setIsExiting(true);
                setTimeout(() => setIsVisible(false), 500);
              }}
              className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm text-gray-700 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

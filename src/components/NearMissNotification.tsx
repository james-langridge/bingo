import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NearMissNotificationProps {
  winnerName: string;
  timeDifference: number;
  onClose: () => void;
}

export function NearMissNotification({
  winnerName,
  timeDifference,
  onClose,
}: NearMissNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-hide after 8 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 500); // Wait for animation to complete
    }, 8000);

    return () => clearTimeout(timer);
  }, [onClose]);

  // Format time difference for display
  const formatTimeDiff = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      const seconds = (ms / 1000).toFixed(1);
      return `${seconds} second${seconds === "1.0" ? "" : "s"}`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  };

  const timeString = formatTimeDiff(timeDifference);
  const isVeryClose = timeDifference < 1000; // Less than 1 second

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ type: "spring", damping: 15, stiffness: 100 }}
          className="fixed top-20 left-0 right-0 z-50 flex justify-center px-4"
        >
          <div className="bg-gradient-to-r from-orange-400 to-amber-500 text-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-3xl">🥈</span>
                  <h3 className="text-xl font-bold">So Close!</h3>
                </div>
                <button
                  onClick={() => setIsVisible(false)}
                  className="text-white/80 hover:text-white transition-colors"
                  aria-label="Close notification"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-lg">
                  <span className="font-semibold">{winnerName}</span> won just
                  before you!
                </p>

                {isVeryClose ? (
                  <div className="bg-white/20 rounded-lg p-3">
                    <p className="text-sm font-medium">
                      ⚡ Lightning fast! You finished just {timeString} after!
                    </p>
                    <p className="text-xs mt-1 opacity-90">
                      That was incredibly close - practically a photo finish!
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/20 rounded-lg p-3">
                    <p className="text-sm">
                      You finished {timeString} after the winner
                    </p>
                    {timeDifference < 3000 && (
                      <p className="text-xs mt-1 opacity-90">
                        Great job - you were right there!
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <div className="flex-1 bg-white/30 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 8, ease: "linear" }}
                      className="h-full bg-white/50"
                    />
                  </div>
                  <span className="text-xs opacity-75">Auto-hide</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

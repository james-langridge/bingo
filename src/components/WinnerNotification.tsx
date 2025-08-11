import { motion } from "framer-motion";

interface WinnerNotificationProps {
  winnerName: string;
  isCurrentPlayer: boolean;
}

export function WinnerNotification({ winnerName, isCurrentPlayer }: WinnerNotificationProps) {
  if (isCurrentPlayer) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-lg p-4 mb-4"
      >
        <div className="flex items-center justify-center space-x-2">
          <span className="text-2xl">🎉</span>
          <span className="text-lg font-bold">Congratulations! You won!</span>
          <span className="text-2xl">🏆</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg shadow-lg p-4 mb-4"
    >
      <div className="flex items-center justify-center space-x-2">
        <span className="text-xl">🏆</span>
        <span className="text-lg font-semibold">
          {winnerName} has won this game!
        </span>
        <span className="text-xl">🎊</span>
      </div>
      <p className="text-center text-sm mt-1 opacity-90">
        The game is now complete
      </p>
    </motion.div>
  );
}
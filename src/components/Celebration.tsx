import { useEffect } from 'react';

export function Celebration() {
  useEffect(() => {
    // Haptic feedback for win
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
  }, []);
  
  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="text-6xl md:text-8xl font-bold animate-bounce">
        🎉
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 animate-pulse">
          BINGO!
        </div>
      </div>
      
      {/* Confetti animation */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-fall"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              fontSize: `${20 + Math.random() * 20}px`,
            }}
          >
            {['🎊', '🎉', '✨', '🌟', '⭐'][Math.floor(Math.random() * 5)]}
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
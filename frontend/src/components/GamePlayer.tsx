import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { GameBoard } from './GameBoard';
import { checkWinCondition } from '../lib/calculations';

export function GamePlayer() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { 
    currentGame, 
    playerState, 
    loadGame, 
    joinGame, 
    markItem, 
    clearMarkedItems 
  } = useGameStore();
  const [displayName, setDisplayName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const initGame = async () => {
      if (!code) {
        setError('Invalid game code');
        setIsLoading(false);
        return;
      }
      
      try {
        await loadGame(code);
        setIsLoading(false);
      } catch (err) {
        setError('Game not found');
        setIsLoading(false);
      }
    };
    
    initGame();
  }, [code, loadGame]);
  
  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !code) return;
    
    setIsJoining(true);
    try {
      await joinGame(code, displayName.trim());
    } catch (err) {
      setError('Failed to join game');
    } finally {
      setIsJoining(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading game...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <div className="text-xl text-red-600 mb-4">{error}</div>
        <button
          onClick={() => navigate('/')}
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
          onClick={() => navigate('/')}
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
            <p className="text-gray-600 mb-6">Game Code: <span className="font-mono font-bold">{code}</span></p>
            
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
                {isJoining ? 'Joining...' : 'Join Game'}
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
            <p className="text-gray-600 mb-4">Game Code: <span className="font-mono font-bold">{code}</span></p>
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
  
  const hasWon = checkWinCondition(
    playerState.markedItems,
    currentGame.settings.gridSize,
    currentGame.settings.requireFullCard
  );
  
  // Shuffle items for this player (deterministic based on player name and game code)
  const shuffledItems = [...currentGame.items].sort(() => Math.random() - 0.5);
  
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">{currentGame.title}</h1>
          <p className="text-gray-600">Playing as: <strong>{playerState.displayName}</strong></p>
          <p className="text-sm text-gray-500">Code: <span className="font-mono">{code}</span></p>
        </div>
        
        {hasWon && (
          <div className="bg-green-100 border-2 border-green-500 text-green-800 p-4 rounded-lg mb-6 max-w-lg mx-auto text-center animate-pulse">
            <p className="text-2xl font-bold">BINGO! You Won!</p>
          </div>
        )}
        
        <GameBoard
          items={shuffledItems}
          markedItems={playerState.markedItems}
          gridSize={currentGame.settings.gridSize}
          onItemClick={markItem}
        />
        
        <div className="flex justify-center mt-6 space-x-4">
          <button
            onClick={clearMarkedItems}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:scale-95 transition-all"
          >
            Clear Board
          </button>
          <div className="text-gray-600 py-2">
            Marked: {playerState.markedItems.length} / {currentGame.items.length}
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';

export function HomePage() {
  const navigate = useNavigate();
  const { localGames, createGame, initialize } = useGameStore();
  const [createTitle, setCreateTitle] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  useEffect(() => {
    initialize();
  }, [initialize]);
  
  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      const game = await createGame(createTitle.trim());
      // Navigate to admin view
      navigate(`/game/${game.gameCode}/admin/${game.adminToken}`);
    } catch (error) {
      console.error('Failed to create game:', error);
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    
    // Navigate to player view
    navigate(`/game/${joinCode.trim().toUpperCase()}`);
  };
  
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Family Bingo
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Create New Game</h2>
          <form onSubmit={handleCreateGame} className="space-y-4">
            <input
              type="text"
              placeholder="Game Title (e.g., Christmas Party 2024)"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              maxLength={100}
            />
            <button
              type="submit"
              disabled={isCreating || !createTitle.trim()}
              className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
            >
              {isCreating ? 'Creating...' : 'Create Game'}
            </button>
          </form>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Join Existing Game</h2>
          <form onSubmit={handleJoinGame} className="space-y-4">
            <input
              type="text"
              placeholder="Enter 6-character game code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-center text-xl font-mono"
              maxLength={6}
            />
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
            >
              Join Game
            </button>
          </form>
        </div>
        
        {localGames.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4">Your Games</h2>
            <div className="space-y-2">
              {localGames.map(game => (
                <div key={game.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50">
                  <div>
                    <div className="font-medium">{game.title}</div>
                    <div className="text-sm text-gray-500 font-mono">Code: {game.gameCode}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/game/${game.gameCode}`)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      Play
                    </button>
                    {game.adminToken && (
                      <button
                        onClick={() => navigate(`/game/${game.gameCode}/admin/${game.adminToken}`)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
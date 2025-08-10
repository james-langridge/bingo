import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import type { BingoItem } from '../../../shared/src/types';

export function GameEditor() {
  const navigate = useNavigate();
  const { code, token } = useParams<{ code: string; token: string }>();
  const { currentGame, loadGameAsAdmin, updateGameItems } = useGameStore();
  const [newItemText, setNewItemText] = useState('');
  const [items, setItems] = useState<BingoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadGame = async () => {
      if (!code || !token) {
        setError('Invalid game URL');
        setIsLoading(false);
        return;
      }
      
      try {
        await loadGameAsAdmin(code, token);
        setIsLoading(false);
      } catch (err) {
        setError('Not authorized to edit this game');
        setIsLoading(false);
      }
    };
    
    loadGame();
  }, [code, token, loadGameAsAdmin]);
  
  useEffect(() => {
    if (currentGame) {
      setItems([...currentGame.items]);
    }
  }, [currentGame]);
  
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    
    const newItem: BingoItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      position: items.length,
    };
    
    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    setNewItemText('');
  };
  
  const handleRemoveItem = (itemId: string) => {
    const updatedItems = items
      .filter(item => item.id !== itemId)
      .map((item, index) => ({ ...item, position: index }));
    setItems(updatedItems);
  };
  
  const handleSaveItems = async () => {
    await updateGameItems(items);
    alert('Game saved successfully!');
  };
  
  const handleShareGame = () => {
    const playerUrl = `${window.location.origin}/game/${code}`;
    const adminUrl = window.location.href;
    
    const shareText = `Game: ${currentGame?.title}\n\nPlayer Link: ${playerUrl}\nGame Code: ${code}\n\nAdmin Link (keep private): ${adminUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: currentGame?.title,
        text: shareText,
      });
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Links copied to clipboard!');
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
  
  const gridSize = currentGame?.settings.gridSize || 5;
  const maxItems = gridSize * gridSize;
  
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold">{currentGame?.title}</h1>
              <p className="text-gray-600">Game Code: <span className="font-mono font-bold">{code}</span></p>
              <p className="text-sm text-gray-500">Grid Size: {gridSize}x{gridSize}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShareGame}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Share Game
              </button>
              <button
                onClick={() => navigate(`/game/${code}`)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Play Game
              </button>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h2 className="text-lg font-semibold mb-2">Add Bingo Items ({items.length}/{maxItems})</h2>
            <form onSubmit={handleAddItem} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Enter bingo item text..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                disabled={items.length >= maxItems}
              />
              <button
                type="submit"
                disabled={!newItemText.trim() || items.length >= maxItems}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add Item
              </button>
            </form>
            
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No items added yet. Start adding items for your bingo game!
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {items.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 border rounded-lg">
                    <span className="w-8 text-center text-gray-500">{index + 1}.</span>
                    <span className="flex-1">{item.text}</span>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {items.length > 0 && (
              <button
                onClick={handleSaveItems}
                className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Save Game
              </button>
            )}
          </div>
        </div>
        
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
          <p className="text-sm">
            <strong>Tip:</strong> Add {maxItems} items to fill your {gridSize}x{gridSize} grid. 
            Players will see these items randomly arranged on their bingo boards.
          </p>
        </div>
      </div>
    </div>
  );
}
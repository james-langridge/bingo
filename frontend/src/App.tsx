import { useState, useCallback } from 'react';
import { GameBoard } from './components/GameBoard';
import { generateDummyItems, checkWinCondition } from './lib/calculations';

function App() {
  const gridSize = 5;
  const [markedItems, setMarkedItems] = useState<string[]>([]);
  const [items] = useState(() => generateDummyItems(gridSize));
  
  const handleItemClick = useCallback((itemId: string) => {
    setMarkedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  }, []);
  
  const hasWon = checkWinCondition(markedItems, gridSize, false);
  
  const handleReset = useCallback(() => {
    setMarkedItems([]);
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Family Bingo
        </h1>
        
        {hasWon && (
          <div className="bg-green-100 border-2 border-green-500 text-green-800 p-4 rounded-lg mb-6 max-w-lg mx-auto text-center">
            <p className="text-xl font-bold">BINGO! You Won! 🎉</p>
          </div>
        )}
        
        <GameBoard
          items={items}
          markedItems={markedItems}
          gridSize={gridSize}
          onItemClick={handleItemClick}
        />
        
        <div className="flex justify-center mt-6 space-x-4">
          <button
            onClick={handleReset}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:scale-95 transition-all"
          >
            Reset Board
          </button>
          <div className="text-gray-600 py-2">
            Marked: {markedItems.length} / {gridSize * gridSize}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
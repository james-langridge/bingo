import { memo } from 'react';

interface BingoItem {
  id: string;
  text: string;
  position: number;
}

interface GameBoardProps {
  items: readonly BingoItem[];
  markedItems: readonly string[];
  gridSize: number;
  onItemClick: (itemId: string) => void;
}

// Pure presentational component
export const GameBoard = memo(({ items, markedItems, gridSize, onItemClick }: GameBoardProps) => {
  return (
    <div 
      className={`grid gap-2 p-4 w-full max-w-lg mx-auto`}
      style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
    >
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onItemClick(item.id)}
          className={`
            aspect-square p-2 rounded-lg text-sm font-medium
            transition-all transform active:scale-95
            ${markedItems.includes(item.id) 
              ? 'bg-green-500 text-white shadow-lg' 
              : 'bg-white text-gray-800 shadow border-2 border-gray-200'
            }
          `}
        >
          {item.text}
        </button>
      ))}
    </div>
  );
});
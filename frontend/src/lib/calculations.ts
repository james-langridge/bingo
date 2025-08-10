// Pure functions only - no side effects
export function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

export function generateAdminToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

export function checkWinCondition(
  markedItems: readonly string[],
  gridSize: number,
  requireFullCard: boolean
): boolean {
  if (requireFullCard) {
    return markedItems.length === gridSize * gridSize;
  }
  // Check rows, columns, and diagonals
  return checkLines(markedItems, gridSize);
}

function checkLines(markedPositions: readonly string[], size: number): boolean {
  // Convert item IDs to positions (assuming IDs are position-based for now)
  const positions = new Set(markedPositions.map(id => parseInt(id)));
  
  // Check rows
  for (let row = 0; row < size; row++) {
    let complete = true;
    for (let col = 0; col < size; col++) {
      if (!positions.has(row * size + col)) {
        complete = false;
        break;
      }
    }
    if (complete) return true;
  }
  
  // Check columns
  for (let col = 0; col < size; col++) {
    let complete = true;
    for (let row = 0; row < size; row++) {
      if (!positions.has(row * size + col)) {
        complete = false;
        break;
      }
    }
    if (complete) return true;
  }
  
  // Check diagonal (top-left to bottom-right)
  let diagonal1Complete = true;
  for (let i = 0; i < size; i++) {
    if (!positions.has(i * size + i)) {
      diagonal1Complete = false;
      break;
    }
  }
  if (diagonal1Complete) return true;
  
  // Check diagonal (top-right to bottom-left)
  let diagonal2Complete = true;
  for (let i = 0; i < size; i++) {
    if (!positions.has(i * size + (size - 1 - i))) {
      diagonal2Complete = false;
      break;
    }
  }
  if (diagonal2Complete) return true;
  
  return false;
}

// Generate dummy items for testing
export function generateDummyItems(gridSize: number): Array<{ id: string; text: string; position: number }> {
  const items = [];
  const phrases = [
    "Dad tells a joke", "Someone spills", "Kids fight", "Phone rings", 
    "Dog barks", "Someone's late", "TV too loud", "Lost remote",
    "Burns food", "Forgot dessert", "Wrong name", "Tells old story",
    "Falls asleep", "Baby cries", "Takes selfie", "Mentions weather",
    "Sports debate", "Politics mention", "Someone leaves early", "Food cold",
    "Wifi issues", "Can't find glasses", "Repeat question", "Wrong gift", "Awkward silence"
  ];
  
  for (let i = 0; i < gridSize * gridSize; i++) {
    items.push({
      id: i.toString(),
      text: phrases[i] || `Item ${i + 1}`,
      position: i
    });
  }
  
  return items;
}
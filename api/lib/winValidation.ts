// Server-side win validation logic

export interface WinValidationResult {
  isValid: boolean;
  reason?: string;
  winType?: "line" | "fullCard";
}

export function validateWinningPositions(
  positions: number[],
  gridSize: number,
  requireFullCard: boolean,
  hasFreeSpace: boolean = true,
): WinValidationResult {
  const totalCells = gridSize * gridSize;

  // Validate position range
  if (positions.some((pos) => pos < 0 || pos >= totalCells)) {
    return { isValid: false, reason: "Invalid position values" };
  }

  // Remove duplicates
  const uniquePositions = [...new Set(positions)];

  if (requireFullCard) {
    // For full card, need all positions except possibly the free space
    const expectedCount = hasFreeSpace ? totalCells - 1 : totalCells;
    const centerPos = Math.floor(totalCells / 2);

    // If has free space, add center position to marked positions for validation
    const markedWithFree =
      hasFreeSpace && !uniquePositions.includes(centerPos)
        ? [...uniquePositions, centerPos]
        : uniquePositions;

    if (markedWithFree.length === totalCells) {
      return { isValid: true, winType: "fullCard" };
    }

    return {
      isValid: false,
      reason: `Full card requires ${expectedCount} positions, got ${uniquePositions.length}`,
    };
  }

  // Check for line wins (row, column, or diagonal)

  // Check rows
  for (let row = 0; row < gridSize; row++) {
    const rowPositions = [];
    for (let col = 0; col < gridSize; col++) {
      rowPositions.push(row * gridSize + col);
    }
    if (
      rowPositions.every(
        (pos) =>
          uniquePositions.includes(pos) ||
          (hasFreeSpace && pos === Math.floor(totalCells / 2)),
      )
    ) {
      return { isValid: true, winType: "line" };
    }
  }

  // Check columns
  for (let col = 0; col < gridSize; col++) {
    const colPositions = [];
    for (let row = 0; row < gridSize; row++) {
      colPositions.push(row * gridSize + col);
    }
    if (
      colPositions.every(
        (pos) =>
          uniquePositions.includes(pos) ||
          (hasFreeSpace && pos === Math.floor(totalCells / 2)),
      )
    ) {
      return { isValid: true, winType: "line" };
    }
  }

  // Check diagonal (top-left to bottom-right)
  const diagonal1 = [];
  for (let i = 0; i < gridSize; i++) {
    diagonal1.push(i * gridSize + i);
  }
  if (
    diagonal1.every(
      (pos) =>
        uniquePositions.includes(pos) ||
        (hasFreeSpace && pos === Math.floor(totalCells / 2)),
    )
  ) {
    return { isValid: true, winType: "line" };
  }

  // Check diagonal (top-right to bottom-left)
  const diagonal2 = [];
  for (let i = 0; i < gridSize; i++) {
    diagonal2.push(i * gridSize + (gridSize - 1 - i));
  }
  if (
    diagonal2.every(
      (pos) =>
        uniquePositions.includes(pos) ||
        (hasFreeSpace && pos === Math.floor(totalCells / 2)),
    )
  ) {
    return { isValid: true, winType: "line" };
  }

  return {
    isValid: false,
    reason: "No winning line found",
  };
}

// Helper to extract winning line positions for audit
export function getWinningLinePositions(
  positions: number[],
  gridSize: number,
  hasFreeSpace: boolean = true,
): number[] | null {
  const uniquePositions = [...new Set(positions)];
  const centerPos = Math.floor((gridSize * gridSize) / 2);

  // Check rows
  for (let row = 0; row < gridSize; row++) {
    const rowPositions = [];
    for (let col = 0; col < gridSize; col++) {
      rowPositions.push(row * gridSize + col);
    }
    if (
      rowPositions.every(
        (pos) =>
          uniquePositions.includes(pos) || (hasFreeSpace && pos === centerPos),
      )
    ) {
      return rowPositions;
    }
  }

  // Check columns
  for (let col = 0; col < gridSize; col++) {
    const colPositions = [];
    for (let row = 0; row < gridSize; row++) {
      colPositions.push(row * gridSize + col);
    }
    if (
      colPositions.every(
        (pos) =>
          uniquePositions.includes(pos) || (hasFreeSpace && pos === centerPos),
      )
    ) {
      return colPositions;
    }
  }

  // Check diagonals
  const diagonal1 = [];
  for (let i = 0; i < gridSize; i++) {
    diagonal1.push(i * gridSize + i);
  }
  if (
    diagonal1.every(
      (pos) =>
        uniquePositions.includes(pos) || (hasFreeSpace && pos === centerPos),
    )
  ) {
    return diagonal1;
  }

  const diagonal2 = [];
  for (let i = 0; i < gridSize; i++) {
    diagonal2.push(i * gridSize + (gridSize - 1 - i));
  }
  if (
    diagonal2.every(
      (pos) =>
        uniquePositions.includes(pos) || (hasFreeSpace && pos === centerPos),
    )
  ) {
    return diagonal2;
  }

  return null;
}

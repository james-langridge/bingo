export interface TileSize {
  cols: number;
  rows: number;
}

/**
 * Simple, responsive tile sizing that prioritizes readability
 * All tiles are same size within each viewport for consistency
 */
export function calculateTileSize(): TileSize {
  return { cols: 1, rows: 1 };
}

/**
 * Responsive padding based on text length
 */
export function getTilePadding(textLength: number): string {
  if (textLength < 30) return "p-6";
  if (textLength < 80) return "p-5";
  if (textLength < 150) return "p-4";
  return "p-3";
}

/**
 * Responsive font sizing optimized for mobile readability
 */
export function getTileFontSize(textLength: number): string {
  if (textLength < 20) return "1.25rem";
  if (textLength < 50) return "1.125rem";
  if (textLength < 100) return "1rem";
  if (textLength < 150) return "0.9375rem";
  return "0.875rem";
}

/**
 * Line height optimized for readability
 */
export function getTileLineHeight(textLength: number): string {
  return textLength > 80 ? "1.5" : "1.6";
}

/**
 * Extracts initials from a display name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Determines tile style classes for list layout
 */
export function getTileClasses(
  isMarkedByMe: boolean,
  isMarkedByAnyone: boolean,
): string {
  const baseClasses = `
    rounded-lg font-medium
    transition-all transform active:scale-[0.98]
    min-h-[80px] w-full
    flex items-center justify-start text-left
    break-words
    relative overflow-hidden
  `;

  if (isMarkedByMe) {
    return `${baseClasses} bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl`;
  }

  if (isMarkedByAnyone) {
    return `${baseClasses} bg-gradient-to-r from-blue-400 to-cyan-400 text-white shadow-md hover:shadow-lg`;
  }

  return `${baseClasses} bg-white text-gray-800 shadow-sm border border-gray-200 hover:border-purple-300 hover:shadow-md`;
}

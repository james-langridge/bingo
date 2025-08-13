import { TEXT_LENGTH_THRESHOLDS } from "../constants";

export interface TileSize {
  cols: number;
  rows: number;
}

/**
 * Calculates tile size based on text length and a seed value for variation
 */
export function calculateTileSize(
  text: string | undefined,
  seed: number,
): TileSize {
  const length = text?.length || 0;
  const variant = seed % 10;

  if (length > TEXT_LENGTH_THRESHOLDS.EXTRA_LONG) {
    if (variant < 3) return { cols: 2, rows: 2 };
    if (variant < 6) return { cols: 3, rows: 1 };
    return { cols: 2, rows: 1 };
  } else if (length > TEXT_LENGTH_THRESHOLDS.LONG) {
    if (variant < 3) return { cols: 2, rows: 1 };
    if (variant < 5) return { cols: 1, rows: 2 };
    if (variant < 7) return { cols: 2, rows: 2 };
    return { cols: 1, rows: 1 };
  } else if (length > TEXT_LENGTH_THRESHOLDS.MEDIUM) {
    if (variant < 2) return { cols: 2, rows: 1 };
    if (variant < 3) return { cols: 1, rows: 2 };
    return { cols: 1, rows: 1 };
  } else if (length < TEXT_LENGTH_THRESHOLDS.SHORT) {
    return { cols: 1, rows: 1 };
  } else {
    if (variant < 1) return { cols: 2, rows: 1 };
    return { cols: 1, rows: 1 };
  }
}

/**
 * Generates a seed value for tile size variation based on text content
 */
export function generateTileSeed(text: string, index: number): number {
  if (!text) return index;

  const firstChar = text.charCodeAt(0) || 0;
  const middleChar = text.charCodeAt(Math.floor(text.length / 2)) || 0;
  const lastChar = text.charCodeAt(text.length - 1) || 0;

  return firstChar + middleChar + lastChar + index;
}

/**
 * Determines padding classes based on tile size and text length
 */
export function getTilePadding(tileSize: TileSize, textLength: number): string {
  const isLargeTile = tileSize.cols > 1 && tileSize.rows > 1;

  if (isLargeTile) return "p-6 md:p-8";
  if (tileSize.cols > 1 || tileSize.rows > 1) return "p-4 md:p-5";
  if (textLength < 20) return "p-4";
  if (textLength < 50) return "p-3";
  return "p-2.5";
}

/**
 * Calculates font size based on tile dimensions and text length
 */
export function getTileFontSize(
  tileSize: TileSize,
  textLength: number,
): string {
  const isLargeTile = tileSize.cols > 1 && tileSize.rows > 1;
  const isWideTile = tileSize.cols > 2;

  if (isLargeTile && textLength < 50) return "1.375rem";
  if (isLargeTile || isWideTile) return "1.125rem";
  if (tileSize.cols > 1 || tileSize.rows > 1) return "1.0625rem";
  if (textLength > 150) return "0.875rem";
  if (textLength > 80) return "0.9375rem";
  return "1rem";
}

/**
 * Calculates line height based on text length
 */
export function getTileLineHeight(textLength: number): string {
  return textLength > 100 ? "1.4" : "1.5";
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
 * Determines tile style classes based on marking state
 */
export function getTileClasses(
  isMarkedByMe: boolean,
  isMarkedByAnyone: boolean,
): string {
  const baseClasses = `
    rounded-xl font-medium
    transition-all transform active:scale-95
    min-h-[90px] w-full h-full
    flex flex-col items-center justify-center text-center
    break-words hyphens-auto
    relative overflow-hidden
  `;

  if (isMarkedByMe) {
    return `${baseClasses} bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-xl scale-[1.02] hover:scale-105`;
  }

  if (isMarkedByAnyone) {
    return `${baseClasses} bg-gradient-to-br from-blue-400 to-cyan-400 text-white shadow-lg hover:scale-105`;
  }

  return `${baseClasses} bg-white text-gray-800 shadow-md border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg`;
}

/**
 * Gets responsive grid column configuration
 */
export function getGridColumns(
  screenSize: "mobile" | "tablet" | "desktop" | "wide",
): string {
  switch (screenSize) {
    case "mobile":
      return "repeat(3, 1fr)";
    case "tablet":
      return "repeat(4, 1fr)";
    case "wide":
      return "repeat(8, 1fr)";
    case "desktop":
    default:
      return "repeat(6, 1fr)";
  }
}

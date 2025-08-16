// Player color assignment system
// Using visually distinct colors that work well on white backgrounds

const PLAYER_COLORS = [
  "#DC2626", // red-600
  "#2563EB", // blue-600
  "#16A34A", // green-600
  "#9333EA", // purple-600
  "#EA580C", // orange-600
  "#0891B2", // cyan-600
  "#DB2777", // pink-600
  "#CA8A04", // yellow-700
  "#0F766E", // teal-700
  "#7C2D12", // amber-900
  "#1E40AF", // blue-800
  "#166534", // green-800
  "#6B21A8", // purple-800
  "#C2410C", // orange-800
  "#BE185D", // pink-800
] as const;

/**
 * Get a consistent color for a player based on their index in the players list
 */
export function getPlayerColor(playerIndex: number): string {
  return PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
}

/**
 * Generate initials from a display name
 */
export function getPlayerInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

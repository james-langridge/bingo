// Player color assignment system
// Using visually distinct colors that work well on white backgrounds

const PLAYER_COLORS = [
  "#16A34A", // green-600 - Current player's color (kept first for consistency)
  "#DC2626", // red-600
  "#2563EB", // blue-600
  "#F59E0B", // amber-500 - Better contrast than previous yellows
  "#8B5CF6", // violet-500 - More distinct from blue
  "#EC4899", // pink-500 - Brighter pink
  "#14B8A6", // teal-500 - Very different from green
  "#F97316", // orange-500 - Brighter orange
  "#6366F1", // indigo-500 - Different shade from blue
  "#84CC16", // lime-500 - Lighter green, very different from main green
  "#06B6D4", // cyan-500 - Distinct cyan
  "#A855F7", // purple-500 - Bright purple
  "#EF4444", // red-500 - Different red shade
  "#3B82F6", // blue-500 - Different blue shade
  "#10B981", // emerald-500 - Different green shade
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

// Time intervals and delays (in milliseconds)
export const TIMEOUTS = {
  ACTIVITY_CHECK: 60_000,      // 60 seconds for vacation mode activity checks
  ONLINE_THRESHOLD: 15_000,    // 15 seconds to consider player online
  NEAR_MISS_WINDOW: 5_000,     // 5 seconds for near-miss detection
  RECOVERY_WINDOW: 300_000,    // 5 minutes for state recovery
  PLAYER_JOIN_RECENT: 30_000,  // 30 seconds to consider join recent
} as const;

// Polling intervals for sync manager
export const POLLING = {
  ACTIVE: 2_000,               // 2 seconds during active play
  IDLE: 10_000,                // 10 seconds after 1 minute idle
  INACTIVE: 30_000,            // 30 seconds after 5 minutes idle
  IMMEDIATE_DELAY: 100,        // 100ms for immediate poll after action
  IDLE_THRESHOLD: 60_000,      // 1 minute to enter idle mode
  INACTIVE_THRESHOLD: 300_000, // 5 minutes to enter inactive mode
} as const;

// Storage and sync configuration
export const STORAGE = {
  SYNC_THROTTLE_MS: 1_000,     // 1 second minimum between syncs
  GAME_TTL_DAYS: 30,           // 30 days TTL for games in Redis
  ERROR_HISTORY_LIMIT: 10,     // Keep last 10 errors in localStorage
  ERROR_LOOP_DETECTION: 1_000, // 1 second for error loop detection
} as const;

// Game configuration
export const GAME_CONFIG = {
  CODE_LENGTH: 6,              // 6 character game codes
  ADMIN_TOKEN_LENGTH: 32,      // 32 character admin tokens
  DEFAULT_GRID_SIZE: 5,        // Default grid size
  MIN_GRID_SIZE: 2,            // Minimum 2x2 grid
  MAX_GRID_SIZE: 10,           // Maximum 10x10 grid for practical reasons
  ANIMATION_DURATION: 300,     // 300ms for animations
} as const;

// API configuration
export const API_CONFIG = {
  MAX_RETRIES: 3,              // Maximum retry attempts
  RETRY_DELAY: 1_000,          // 1 second between retries
  REQUEST_TIMEOUT: 10_000,     // 10 second request timeout
} as const;

// UI configuration
export const UI_CONFIG = {
  HAPTIC_DURATION: 10,         // 10ms haptic feedback
  TOAST_DURATION: 3_000,       // 3 seconds for toast notifications
  DEBOUNCE_DELAY: 300,         // 300ms debounce for inputs
} as const;

// Grid and tile configuration
export const GRID_CONFIG = {
  MOBILE_COLUMNS: 3,           // 3 columns on mobile
  TABLET_COLUMNS: 4,           // 4 columns on tablet
  DESKTOP_COLUMNS: 6,          // 6 columns on desktop
  WIDE_COLUMNS: 8,             // 8 columns on wide screens
  MIN_TILE_HEIGHT: 90,         // 90px minimum tile height
  AUTO_ROW_HEIGHT: 'minmax(90px, auto)',
} as const;

// Text length thresholds for tile sizing
export const TEXT_LENGTH_THRESHOLDS = {
  SHORT: 15,                   // Very short text
  MEDIUM: 50,                  // Medium length text
  LONG: 100,                   // Long text
  EXTRA_LONG: 180,             // Extra long text
} as const;
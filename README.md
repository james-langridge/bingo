# Bingo

A real-time multiplayer Progressive Web Application (PWA) for creating and playing custom bingo games. Built with React, TypeScript, Vite, and Vercel serverless functions, featuring real-time synchronization, offline functionality, and zero-authentication gameplay.

## Architecture Overview

### Core Design Principles

- **Zero Authentication**: No user accounts required. Games are created anonymously and shared via 6-character codes.
- **Real-Time Multiplayer**: Support for multiple simultaneous players with live synchronization.
- **Offline-First**: Full functionality offline with automatic sync when reconnected.
- **Mobile-First**: Optimized for touch devices with responsive design.
- **Functional Core**: Business logic implemented as pure functions with immutable data structures.
- **Optimistic Updates**: Instant UI feedback with server reconciliation.

### Technology Stack

#### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **State Management**: Zustand with Immer for immutable updates
- **Offline Storage**: Dexie.js (IndexedDB wrapper)
- **Styling**: Tailwind CSS with inline styles
- **PWA**: Vite PWA plugin with Workbox
- **Routing**: React Router v7

#### Backend
- **Runtime**: Vercel Serverless Functions
- **Database**: Redis (Upstash) for persistent storage
- **API**: RESTful endpoints with smart polling
- **Validation**: Runtime type checking with TypeScript
- **Logging**: Pino for structured logging

## Project Structure

```
bingo/
├── src/
│   ├── components/       # React components
│   │   ├── GameBoard.tsx      # Main bingo board grid
│   │   ├── GameEditor.tsx     # Admin interface for editing games
│   │   ├── GamePlayer.tsx     # Player interface
│   │   ├── HomePage.tsx       # Landing page with game creation
│   │   ├── ShareModal.tsx     # QR code and sharing functionality
│   │   ├── Celebration.tsx    # Win animation component
│   │   ├── ConnectionStatus.tsx # Real-time connection indicator
│   │   ├── WinnerNotification.tsx # Winner announcement display
│   │   ├── NearMissNotification.tsx # Near-win notifications
│   │   ├── ErrorBoundary.tsx  # Error handling wrapper
│   │   └── LoadingSkeleton.tsx # Loading states
│   ├── lib/             # Pure business logic
│   │   ├── calculations.ts    # Game logic and utilities
│   │   ├── storage.ts        # IndexedDB operations
│   │   ├── syncManager.ts    # Real-time sync orchestration
│   │   └── templates.ts      # Pre-made game templates
│   ├── stores/          # State management
│   │   └── gameStore.ts      # Zustand store
│   ├── types/           # TypeScript definitions
│   │   └── types.ts          # Core domain types
│   ├── hooks/           # Custom React hooks
│   │   └── usePullToRefresh.ts # Pull-to-refresh functionality
│   ├── App.tsx          # Root component with routing
│   └── main.tsx         # Application entry point
├── api/                 # Vercel serverless functions
│   ├── game/
│   │   ├── [code].ts         # Game CRUD operations
│   │   └── [code]/
│   │       └── claim-win.ts  # Atomic win validation
│   ├── player/
│   │   └── [code].ts         # Player state management
│   └── game/changes/
│       └── [code].ts         # Polling endpoint for updates
├── public/              # Static assets
│   ├── bingo-icon.svg        # App icon
│   └── icon-*.png            # PWA icons
├── vercel.json          # Vercel deployment configuration
└── vite.config.ts       # Build configuration
```

## Core Concepts

### Game Model

Games are stored with the following properties:

- **gameCode**: 6-character alphanumeric code for sharing (e.g., "ABC123")
- **adminToken**: 32-character secret token for administrative access
- **items**: Array of bingo items with text and position
- **settings**: Grid size (3x3, 4x4, or 5x5), win conditions, free space option
- **players**: Map of active players with display names and join times
- **squares**: Multi-person marking support with notes and photos (vacation mode)
- **winner**: Player who successfully claimed victory
- **lastModifiedAt**: Timestamp for change detection

### URL Structure

- `/` - Home page with game creation and join options
- `/game/:code` - Player view for a specific game
- `/game/:code/admin/:token` - Admin view for editing game items

### State Management

The application uses Zustand for state management with the following stores:

- **gameStore**: Manages current game, player state, and synchronization
  - Actions: `createGame`, `loadGame`, `updateGameItems`, `markPosition`, `claimWin`, `syncWithServer`
  - State: `currentGame`, `playerState`, `localGames`, `isLoading`, `isSyncing`, `connectionStatus`
  - Real-time sync: Automatic polling with adaptive intervals based on activity

### Storage Architecture

#### Local Storage (IndexedDB via Dexie.js)
- **games**: Complete game objects indexed by gameCode
- **playerStates**: Player progress and marked squares
- **pendingEvents**: Offline action queue for sync

#### Server Storage (Redis via Upstash)
- **Game state**: Authoritative game data with atomic operations
- **Player registry**: Active players and their states
- **Win validation**: Server-side verification of win claims
- **Change tracking**: Timestamps for efficient polling

### Win Condition Logic

The game supports multiple win conditions:

- **Line Win**: Complete any row, column, or diagonal
- **Full Card**: Mark all squares on the board
- **Free Space**: Optional center square that's automatically marked
- **Near-Miss Detection**: Notifications when one square away from winning
- **Atomic Win Claims**: Server-side validation prevents race conditions

Win detection is implemented in `src/lib/calculations.ts:checkWinCondition` with server validation in `api/game/[code]/claim-win.ts`.

## Development

### Prerequisites

- Node.js 20+ LTS
- npm 10+

### Installation

```bash
npm install
```

### Available Scripts

```bash
npm run dev       # Start development server on port 5173
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

### Environment Variables

For local development with full backend functionality:

```bash
# Redis connection (required for backend)
KV_REST_API_URL=your_upstash_redis_url
KV_REST_API_TOKEN=your_upstash_redis_token

# Optional
NODE_ENV=development
```

The frontend can run without these variables but will have limited functionality (no real-time sync or multiplayer).

## Key Features

### Real-Time Multiplayer

- **Live Synchronization**: Smart polling with adaptive intervals (100ms to 30s)
- **Optimistic Updates**: Instant UI feedback with server reconciliation
- **Conflict Resolution**: Automatic merging of concurrent player actions
- **Connection Status**: Visual indicators for online/offline/syncing states
- **Player Presence**: See who's playing in real-time

### Progressive Web App

- **Installable**: Can be installed as a standalone app on mobile and desktop
- **Offline Support**: Full functionality without network connection
- **Service Worker**: Caches assets and enables offline mode
- **App Manifest**: Defines app metadata and icons
- **Background Sync**: Automatic synchronization when reconnected

### Game Templates

Pre-configured templates available for common scenarios:

- Holiday Dinner
- Road Trip  
- Family Reunion
- Video Call
- Birthday Party

Templates are defined in `src/lib/templates.ts`.

### Sharing Functionality

Games can be shared via:

- **QR Code**: Generated client-side using qrcode library
- **Direct Link**: Shareable URL with game code
- **Web Share API**: Native sharing on supported devices

### Mobile Optimizations

- **Touch Targets**: Minimum 44x44px for iOS compatibility
- **Haptic Feedback**: Vibration on item selection (when supported)
- **Pull to Refresh**: Custom implementation for game state refresh
- **Responsive Grid**: Adapts to different screen sizes
- **Viewport Locking**: Prevents zoom and maintains portrait orientation

### Advanced Features

- **Vacation Mode**: Multi-person square marking with notes and photos
- **Near-Miss Notifications**: Alerts when one square away from winning
- **Winner Celebrations**: Confetti animation and winner announcement
- **Atomic Win Claims**: Server-side validation prevents race conditions
- **Error Boundaries**: Graceful error handling with game recovery

## Data Flow

1. **Game Creation**:
   - User enters title → Generate codes → Create game object → Save to IndexedDB → Upload to server → Navigate to admin view

2. **Game Playing**:
   - Join game → Fetch from server → Cache locally → Display board → Track marks → Sync with server

3. **Real-Time Synchronization**:
   - Local action → Optimistic update → Queue for sync → Poll server for changes → Merge states → Update UI

4. **Win Flow**:
   - Detect win condition → Claim win on server → Atomic validation → Broadcast to all players → Celebration

5. **Offline Mode**:
   - Actions queued locally → Store in IndexedDB → Auto-sync when online → Conflict resolution

## Code Organization

### Pure Functions (`src/lib/`)

Business logic is implemented as pure functions with no side effects:

- `generateGameCode()`: Creates unique 6-character codes
- `generateAdminToken()`: Creates 32-character admin tokens
- `checkWinCondition()`: Determines if player has won
- `shuffleItems()`: Deterministic shuffle based on seed

### Components (`src/components/`)

React components follow functional patterns:

- Props are readonly interfaces
- Components are memoized where beneficial
- Side effects handled in effect hooks
- Event handlers passed as props

### Storage Operations (`src/lib/storage.ts`)

All IndexedDB operations are async and return promises:

- `saveGameLocal()`: Persist game to IndexedDB
- `loadGameByCode()`: Retrieve game by code
- `savePlayerState()`: Persist player progress
- `loadPlayerState()`: Retrieve player progress
- `queueOfflineAction()`: Queue actions for sync
- `processOfflineQueue()`: Sync queued actions when online

### Synchronization (`src/lib/syncManager.ts`)

Manages real-time synchronization with smart polling:

- `startPolling()`: Begin adaptive polling with exponential backoff
- `stopPolling()`: Pause synchronization
- `syncGameState()`: Fetch and merge server state
- `mergeGameStates()`: Conflict-free merge of local and remote states

## Testing Approach

While formal tests are not yet implemented, the architecture supports:

- **Unit Testing**: Pure functions in `/lib` are easily testable
- **Component Testing**: Props-based components with clear interfaces
- **Integration Testing**: Store actions and storage operations
- **E2E Testing**: User flows through the routing system

## Performance Considerations

- **Bundle Size**: ~200KB gzipped total
- **Code Splitting**: Not currently implemented (single-page app)
- **Lazy Loading**: Templates loaded on demand
- **Memoization**: GameBoard component memoized to prevent re-renders
- **IndexedDB**: Async operations prevent blocking UI

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

PWA features require HTTPS in production.

## Security Considerations

- **Admin Tokens**: 32-character random strings, never exposed in UI or API responses
- **Game Codes**: 6-character codes are public, no sensitive data
- **Input Validation**: Text inputs validated with length constraints
- **XSS Protection**: React's default escaping prevents injection
- **API Security**: Rate limiting and input validation on all endpoints
- **Data Privacy**: No personal data collected, all games anonymous
- **CORS**: Configured for production domain only

## Architecture Highlights

### Smart Polling System

The application uses an innovative polling approach instead of WebSockets/SSE:

- **Adaptive Intervals**: 100ms during activity, exponential backoff to 30s when idle
- **Change Detection**: Uses timestamps to skip unnecessary updates
- **Battery Efficient**: Reduces polling when app is in background
- **Network Resilient**: Automatic retry with exponential backoff

### Conflict Resolution

Multi-player conflicts are resolved using:

- **Last-Write-Wins**: For most game properties
- **Union Merge**: For player marks (combines all marks)
- **Atomic Operations**: For win claims (first valid claim wins)
- **Optimistic UI**: Updates show immediately, reconcile with server

## Deployment

The application is deployed on Vercel:

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

Required Vercel environment variables:
- `KV_REST_API_URL`: Upstash Redis REST API URL
- `KV_REST_API_TOKEN`: Upstash Redis REST API token

## Contributing

When contributing to this codebase:

1. Follow the functional programming patterns established
2. Keep components pure and side-effect free
3. Use TypeScript's readonly types for immutability
4. Implement business logic as pure functions in `/lib`
5. Test offline functionality thoroughly
6. Maintain mobile-first responsive design
7. Ensure minimum touch target sizes (44x44px)
8. Document any new URL routes or state changes

## License

This project is licensed under the WTFPL - see http://www.wtfpl.net/ for details.

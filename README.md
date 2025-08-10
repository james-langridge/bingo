# Bingo

A Progressive Web Application (PWA) for creating and playing custom bingo games. Built with React, TypeScript, and Vite, featuring offline functionality and zero-authentication gameplay.

## Architecture Overview

### Core Design Principles

- **Zero Authentication**: No user accounts required. Games are created anonymously and shared via 6-character codes.
- **Offline-First**: Full functionality offline using IndexedDB for local storage.
- **Mobile-First**: Optimized for touch devices with responsive design.
- **Functional Core**: Business logic implemented as pure functions with immutable data structures.

### Technology Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **State Management**: Zustand with Immer for immutable updates
- **Offline Storage**: Dexie.js (IndexedDB wrapper)
- **Styling**: Tailwind CSS with inline styles
- **PWA**: Vite PWA plugin with Workbox
- **UI Components**: Radix UI primitives for accessible components
- **Routing**: React Router v7

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
│   │   └── LoadingSkeleton.tsx # Loading states
│   ├── lib/             # Pure business logic
│   │   ├── calculations.ts    # Game logic and utilities
│   │   ├── storage.ts        # IndexedDB operations
│   │   └── templates.ts      # Pre-made game templates
│   ├── stores/          # State management
│   │   └── gameStore.ts      # Zustand store
│   ├── types/           # TypeScript definitions
│   │   └── types.ts          # Core domain types
│   ├── hooks/           # Custom React hooks
│   │   └── usePullToRefresh.ts # Pull-to-refresh functionality
│   ├── App.tsx          # Root component with routing
│   └── main.tsx         # Application entry point
├── public/              # Static assets
│   ├── bingo-icon.svg        # App icon
│   └── icon-*.png            # PWA icons
└── vite.config.ts       # Build configuration
```

## Core Concepts

### Game Model

Games are stored as immutable data structures with the following properties:

- **gameCode**: 6-character alphanumeric code for sharing (e.g., "ABC123")
- **adminToken**: 32-character secret token for administrative access
- **items**: Array of bingo items with text and position
- **settings**: Grid size (3x3, 4x4, or 5x5), win conditions, free space option

### URL Structure

- `/` - Home page with game creation and join options
- `/game/:code` - Player view for a specific game
- `/game/:code/admin/:token` - Admin view for editing game items

### State Management

The application uses Zustand for state management with the following stores:

- **gameStore**: Manages current game, player state, and local games list
  - Actions: `createGame`, `loadGame`, `updateGameItems`, `markPosition`
  - State: `currentGame`, `playerState`, `localGames`, `isLoading`

### Storage Layer

IndexedDB is used for persistent local storage via Dexie.js:

- **games**: Stores complete game objects indexed by gameCode
- **playerStates**: Stores player progress indexed by gameCode
- **pendingEvents**: Queue for offline sync (future implementation)

### Win Condition Logic

The game supports multiple win conditions:

- **Line Win**: Complete any row, column, or diagonal
- **Full Card**: Mark all squares on the board
- **Free Space**: Optional center square that's automatically marked

Win detection is implemented in `src/lib/calculations.ts:checkWinCondition`.

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

The application runs entirely client-side and requires no environment variables.

## Key Features

### Progressive Web App

- **Installable**: Can be installed as a standalone app on mobile and desktop
- **Offline Support**: Full functionality without network connection
- **Service Worker**: Caches assets and enables offline mode
- **App Manifest**: Defines app metadata and icons

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

## Data Flow

1. **Game Creation**:
   - User enters title → Generate codes → Create game object → Save to IndexedDB → Navigate to admin view

2. **Game Playing**:
   - Load game from IndexedDB → Display board → Track marked positions → Check win conditions → Show celebration

3. **State Persistence**:
   - All state changes → Update Zustand store → Persist to IndexedDB → Available offline

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

- **Admin Tokens**: 32-character random strings, never exposed in UI
- **Game Codes**: 6-character codes are public, no sensitive data
- **Local Storage**: All data stored client-side, no server communication
- **Input Validation**: Text inputs have max length constraints
- **XSS Protection**: React's default escaping prevents injection

## Future Considerations

The codebase is structured to support future enhancements:

- **Server Sync**: Event sourcing system prepared for backend integration
- **Real-time Updates**: WebSocket support via pending events queue
- **User Accounts**: Optional authentication layer
- **Game Analytics**: Event tracking infrastructure in place
- **Multiplayer**: Shared state synchronization

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

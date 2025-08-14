# Bingo

A real-time multiplayer Progressive Web Application for creating and playing custom bingo games. Built with React, TypeScript, Vite, and Fastify, featuring real-time synchronization through Server-Sent Events, offline functionality, and zero-authentication gameplay.

## Architecture Overview

### Core Design Principles

- **Zero Authentication**: No user accounts required. Games are created anonymously and shared via 6-character codes.
- **Real-Time Multiplayer**: Support for multiple simultaneous players with instant updates via Server-Sent Events.
- **Offline-First**: Full functionality offline with automatic sync when reconnected.
- **Mobile-First**: Optimized for touch devices with responsive design.
- **Functional Core**: Business logic implemented as pure functions with immutable data structures.

### Technology Stack

#### Frontend

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **State Management**: Zustand 5 with Immer for immutable updates
- **Offline Storage**: Dexie.js (IndexedDB wrapper)
- **Styling**: Tailwind CSS 4
- **PWA**: Vite PWA plugin with Workbox
- **Routing**: React Router v7
- **UI Components**: Radix UI primitives
- **Animations**: Framer Motion

#### Backend

- **Runtime**: Node.js 20 LTS with Fastify 4
- **Database**: Upstash Redis for storage, Redis (IORedis) for pub/sub
- **Real-time**: Server-Sent Events (SSE) with Redis pub/sub
- **Validation**: Zod for runtime type checking
- **Logging**: Pino for structured logging
- **Deployment**: Railway with Node.js server

## Project Structure

```
bingo/
├── src/
│   ├── components/         # React components
│   │   ├── GameBoard/          # Bingo board grid with tile component
│   │   │   ├── index.tsx       # Main board component
│   │   │   └── BingoTile.tsx   # Individual tile component
│   │   ├── GameEditor.tsx      # Admin interface for editing games
│   │   ├── GamePlayer.tsx      # Player interface
│   │   ├── HomePage.tsx        # Landing page with game creation
│   │   ├── ShareModal.tsx      # QR code and sharing functionality
│   │   ├── Celebration.tsx     # Win animation component
│   │   ├── ConnectionStatus.tsx # Real-time connection indicator
│   │   ├── WinnerNotification.tsx # Winner announcement display
│   │   ├── ErrorBoundary.tsx   # Error handling wrapper
│   │   └── LoadingSkeleton.tsx # Loading states
│   ├── lib/                # Pure business logic
│   │   ├── calculations.ts     # Game logic and utilities
│   │   ├── storage.ts          # IndexedDB operations
│   │   ├── syncManager.ts      # SSE connection management
│   │   ├── templates.ts        # Pre-made game templates
│   │   └── constants.ts        # Application constants
│   ├── stores/             # State management
│   │   ├── gameStore.ts        # Main Zustand store
│   │   ├── actions/            # Store action modules
│   │   │   ├── gameActions.ts
│   │   │   ├── playerActions.ts
│   │   │   └── winActions.ts
│   │   └── calculations/       # Store calculation helpers
│   │       ├── gameCalculations.ts
│   │       ├── itemCalculations.ts
│   │       └── winValidation.ts
│   ├── schemas/            # Data validation
│   │   ├── gameSchemas.ts      # Zod schemas for game data
│   │   └── validation.ts       # Validation helpers
│   ├── types/              # TypeScript definitions
│   │   ├── types.ts            # Core domain types
│   │   └── events.ts           # Event type definitions
│   ├── hooks/              # Custom React hooks
│   │   ├── useGameBoard.ts     # Game board logic hook
│   │   └── useResponsiveGrid.ts # Responsive grid calculations
│   ├── App.tsx             # Root component with routing
│   └── main.tsx            # Application entry point
├── server/                 # Backend server
│   ├── server.js               # Fastify server with SSE support
│   └── package.json            # Server dependencies
├── public/                 # Static assets
│   ├── bingo-icon.svg          # App icon
│   └── icon-*.png              # PWA icons
├── railway.json            # Railway deployment configuration
├── DEPLOYMENT.md           # Deployment guide
└── vite.config.ts          # Build configuration
```

## Core Concepts

### Game Model

Games are stored with the following properties:

- **gameCode**: 6-character alphanumeric code for sharing (e.g., "ABC123")
- **adminToken**: 32-character secret token for administrative access
- **items**: Array of bingo items with text and position
- **settings**: Grid size (any NxN), win conditions, free space option
- **players**: Array of active players with display names and connection status
- **markedSquares**: Map of position to array of player marks
- **winner**: Player who successfully claimed victory
- **lastModifiedAt**: Timestamp for change detection

### URL Structure

- `/` - Home page with game creation and join options
- `/game/:code` - Player view for a specific game
- `/game/:code/admin/:token` - Admin view for editing game items

### State Management

The application uses Zustand for state management with modular actions:

- **gameStore**: Central store managing game state
  - Game Actions: `createGame`, `loadGame`, `updateGameItems`
  - Player Actions: `joinGame`, `markPosition`, `updatePlayerName`
  - Win Actions: `claimWin`, `checkWinCondition`
  - Sync Actions: `connectSSE`, `disconnect`, `syncWithServer`

### Storage Architecture

#### Local Storage (IndexedDB via Dexie.js)

- **games**: Complete game objects indexed by gameCode
- **playerStates**: Player progress and marked squares
- **pendingEvents**: Offline action queue for sync

#### Server Storage (Redis)

- **Upstash Redis**: Persistent game state and player data
- **Redis Pub/Sub**: Real-time event broadcasting
- **TTL**: 30 days for games, 7 days for player states

### Real-Time Synchronization

The application uses Server-Sent Events (SSE) for efficient real-time updates:

- **Persistent Connection**: Single SSE connection per game
- **Zero Polling**: Events pushed instantly via Redis pub/sub
- **Auto-Reconnect**: Automatic reconnection on network interruption
- **Tab Visibility**: Pauses connection when tab is hidden
- **Heartbeat**: Keep-alive messages every 30 seconds

### Win Condition Logic

The game supports multiple win conditions:

- **Line Win**: Complete any row, column, or diagonal
- **Full Card**: Mark all squares on the board
- **Free Space**: Optional center square that's automatically marked

Win detection is implemented in `src/lib/calculations.ts:checkWinCondition` with server-side validation.

## Development

### Prerequisites

- Node.js 20+ LTS
- npm 10+
- Redis (for local server development)

### Installation

```bash
npm install
cd server && npm install
```

### Available Scripts

```bash
# Frontend development
npm run dev           # Start development server on port 5173

# Backend development
npm run dev:server    # Start backend server with hot reload

# Building
npm run build         # Build frontend for production
npm run build:all     # Build frontend and prepare server

# Testing
npm run test          # Run tests with Vitest
npm run test:ui       # Run tests with UI
npm run test:coverage # Generate coverage report

# Code quality
npm run lint          # Run ESLint
npx prettier . --write # Format code
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Redis connections (required for backend)
KV_REST_API_URL=your_upstash_redis_rest_url
KV_REST_API_TOKEN=your_upstash_redis_rest_token
REDIS_URL=redis://localhost:6379  # For local Redis

# Optional
NODE_ENV=development
PORT=3001
LOG_LEVEL=info
```

## Deployment

The application is deployed on Railway as a monorepo with a Node.js server.

### Quick Deploy to Railway

1. Push code to GitHub
2. Connect repository to Railway
3. Add environment variables (Upstash Redis credentials)
4. Deploy

Railway automatically detects the build configuration from `railway.json`.

## API Endpoints

The Fastify server provides the following endpoints:

### SSE Connection

- `GET /api/game/events/:code` - Server-Sent Events stream for real-time updates

### Game Management

- `POST /api/game/:code` - Update game state

### Player Management

- `GET /api/player/:code?playerId=xxx` - Get player state
- `POST /api/player/:code` - Save player state
- `POST /api/player/:code/heartbeat` - Update player presence

### Health Check

- `GET /health` - Server health status

## Testing

The project includes unit tests for core functionality:

- `src/lib/calculations.test.ts` - Game logic tests
- `src/lib/storage.test.ts` - Storage operations tests
- `src/lib/templates.test.ts` - Template validation tests
- `src/stores/gameStore.test.ts` - State management tests
- `src/components/GameBoard.test.tsx` - Component tests
- `src/components/ErrorBoundary.test.tsx` - Error boundary tests

Run tests with:

```bash
npm test              # Run all tests
npm run test:ui       # Interactive test UI
npm run test:coverage # Coverage report
```

## Key Features

### Progressive Web App

- **Installable**: Can be installed as a standalone app
- **Offline Support**: Full functionality without network
- **Service Worker**: Caches assets for offline use
- **Background Sync**: Queues actions when offline

### Sharing

Games can be shared via:

- **QR Code**: Generated client-side
- **Direct Link**: Shareable URL
- **Web Share API**: Native sharing on supported devices

### Mobile Optimizations

- **Touch Targets**: Minimum 44x44px for accessibility
- **Haptic Feedback**: Vibration on supported devices
- **Responsive Grid**: Adapts to screen size
- **Viewport Control**: Optimized for mobile browsers

## Performance

- **Bundle Size**: ~200KB gzipped
- **Time to Interactive**: < 5 seconds on 3G
- **Lighthouse Score**: 90+ in all categories
- **Zero CPU Usage**: When game is idle (SSE-based)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

PWA features require HTTPS in production.

## Security

- **Admin Tokens**: 32-character random strings, never exposed
- **Input Validation**: Zod schemas validate all inputs
- **XSS Protection**: React's default escaping
- **Rate Limiting**: Built into Railway infrastructure
- **CORS**: Configured for production domain
- **No Personal Data**: All gameplay is anonymous

## License

WTFPL - See http://www.wtfpl.net/ for details

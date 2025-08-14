# Bingo Server

This is the Node.js server that powers the Bingo game, serving both the frontend and API.

## Architecture

- **Fastify** - Fast and lightweight web framework
- **Redis Pub/Sub** - For instant broadcasting of game events
- **Upstash Redis** - For persistent game storage
- **Server-Sent Events (SSE)** - For real-time updates to clients

## Installation

```bash
cd server
npm install
```

## Environment Variables

Create a `.env` file in the project root:

```env
# Upstash Redis (for data storage)
KV_REST_API_URL=https://your-upstash-url.upstash.io
KV_REST_API_TOKEN=your-upstash-token

# Redis for pub/sub (local or Railway Redis)
REDIS_URL=redis://localhost:6379

# Server config
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
```

## Development

```bash
# Start the server with auto-reload
npm run dev

# Or from project root:
npm run dev:server
```

## API Endpoints

### Game Management

- `GET /api/game/:code` - Get game state
- `POST /api/game/:code` - Update game state
- `POST /api/game/:code/claim-win` - Claim victory

### Player Management

- `GET /api/player/:code` - Get player state
- `POST /api/player/:code` - Save player state
- `POST /api/player/:code/heartbeat` - Update player online status

### Real-time Updates

- `GET /api/game/events/:code` - SSE endpoint for real-time updates

### Health Check

- `GET /health` - Server health status

## How It Works

1. **Zero Polling**: When games are idle, there's no polling. The server uses Redis pub/sub to instantly broadcast changes.

2. **Event Broadcasting**: When any game state changes:
   - Update is saved to Upstash
   - Event is published to Redis channel
   - All connected SSE clients receive the update instantly

3. **Connection Management**:
   - SSE connections persist indefinitely
   - Automatic cleanup when clients disconnect
   - Per-game subscription management

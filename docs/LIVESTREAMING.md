# Livestreaming Architecture

## Overview

Grgr uses a **dual-transport architecture** for livestreaming:

- **LiveKit** handles real-time video/audio transport (WebRTC)
- **Socket.io** handles chat messages, gift events, viewer count updates, and battle events

Both systems connect to the same "room" concept using the **livestream ID** as the room name.

## Why Dual Transport?

| Feature | Transport | Reason |
|---------|-----------|--------|
| Video/Audio | LiveKit | Purpose-built for media, handles SFU routing, adaptive bitrate, simulcast |
| Chat | Socket.io | Already implemented, lightweight text, no need for WebRTC data channels |
| Gifts | Socket.io | Event-driven animations, low-latency text payloads |
| Viewer Count | Socket.io + Redis | Real-time counter synced across connections |
| Battle Scores | Socket.io | Simple numeric updates |

## Livestream Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  1. STREAMER taps "Go Live"                                      │
│     → POST /api/live/start                                       │
│     → Creates DB record (is_active=1)                            │
│     → Generates LiveKit publisher token (canPublish=true)        │
│     → Notifies all followers via push notifications              │
│     → Returns { stream, token, livekitUrl }                      │
├─────────────────────────────────────────────────────────────────┤
│  2. STREAMER connects to LiveKit room                            │
│     → Publishes camera + microphone tracks                       │
│     → Also connects to Socket.io /live namespace for chat        │
├─────────────────────────────────────────────────────────────────┤
│  3. VIEWER taps a stream in the Live List                        │
│     → POST /api/live/:streamId/join                              │
│     → Generates LiveKit subscriber token (canPublish=false)      │
│     → Viewer connects to LiveKit room (subscribes to video)      │
│     → Also connects to Socket.io for chat + gifts                │
├─────────────────────────────────────────────────────────────────┤
│  4. DURING STREAM                                                │
│     → LiveKit: Video/audio flows streamer → SFU → all viewers    │
│     → Socket.io: Chat, gifts, viewer count in parallel           │
│     → LiveKit webhooks update viewer_count in DB                 │
├─────────────────────────────────────────────────────────────────┤
│  5. STREAMER taps "End Stream"                                   │
│     → POST /api/live/:streamId/end                               │
│     → DB: is_active=0, ended_at=now()                            │
│     → Closes LiveKit room (disconnects all participants)         │
│     → Cleans up Redis viewer counter                             │
│     → OR: LiveKit sends room_finished webhook → auto-cleanup     │
└─────────────────────────────────────────────────────────────────┘
```

## Setting Up LiveKit Cloud (Development)

1. Go to [https://cloud.livekit.io](https://cloud.livekit.io) and create a free account
2. Create a new project — you get a free tier with generous limits
3. Copy your credentials:
   - **API Key** (e.g., `APIxxxxxxxxx`)
   - **API Secret** (e.g., `xxxxxxxxxxxxxxxxxxxx`)
   - **WebSocket URL** (e.g., `wss://your-project-id.livekit.cloud`)
4. Add them to `backend/.env`:
   ```
   LIVEKIT_API_KEY=APIxxxxxxxxx
   LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxx
   LIVEKIT_URL=wss://your-project-id.livekit.cloud
   ```
5. (Optional) Configure webhooks in the LiveKit dashboard:
   - URL: `https://your-backend-url/api/webhooks/livekit`
   - This enables automatic viewer count updates and stream cleanup

## Local Development

### Important: Development Builds Required

The LiveKit React Native SDK (`@livekit/react-native`) requires **native modules** that are NOT available in Expo Go. You must use a **development build**:

```bash
cd mobile
npx expo prebuild
npx expo run:ios   # or npx expo run:android
```

### Web Development

On web, LiveKit works out of the box using the browser's native WebRTC. No development build needed — `npx expo start --web` works directly.

### Without LiveKit Configured

If `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, or `LIVEKIT_URL` are empty:
- The Go Live screen falls back to **expo-camera** preview (no video transmission)
- The Viewer screen falls back to a **sample video** background
- Chat, gifts, and viewer count still work via Socket.io
- The app is fully functional for UI development without a LiveKit account

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/live` | No | List all active livestreams |
| GET | `/api/live/:streamId` | No | Get single stream details |
| POST | `/api/live/start` | Yes | Start a new livestream |
| POST | `/api/live/:streamId/join` | Yes | Join as viewer, get token |
| POST | `/api/live/:streamId/end` | Yes | End a livestream |
| POST | `/api/webhooks/livekit` | Webhook | LiveKit event handler |

## Platform-Specific Wrappers

The LiveKit integration uses platform-specific files:

- `components/live/LiveKitRoom.web.js` — Uses `@livekit/components-react` with browser WebRTC
- `components/live/LiveKitRoom.js` — Uses `livekit-client` for React Native, falls back gracefully

Both export the same API: `LiveKitPublisher` and `LiveKitViewer` components.

## Testing

```bash
cd backend
npm test
```

Tests cover:
- Token generation (publisher vs viewer permissions, JWT structure)
- Webhook event handling (participant_joined, participant_left, room_finished)
- API logic (lifecycle state transitions, viewer count bounds)

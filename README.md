# Private Duo Chat

Private Duo Chat is a password-protected, two-person real-time chat web app.
There is one shared room, no DMs, no channels, no accounts.

Password is hardcoded as **0327** for the MVP.

## Features

- Password-protected entry (username + shared room password)
- Real-time messaging with Socket.io
- Single shared timeline for two people
- Message timestamps
- Reply to messages with quote preview
- Edit and delete your own messages
- Emoji reactions
- Typing indicator
- Metered WebRTC call panel (voice, video, screen share, mute, VAD)
- Discord-inspired dark UI

## Tech Stack

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- Backend: Node.js + Express
- Real-time: Socket.io
- Voice/Video: Metered (WebRTC embed)
- Database: In-memory for MVP (schemas provided below)

## Project Structure

```
/client                React app
  /src
    /components        UI components
    /lib               helpers + config
    /types.ts          shared data types
/server                Express + Socket.io server
  /src/index.js        API + socket events
/docs/RESEARCH.md      design references and patterns
/.gitignore
/README.md
```

## Backend Routes

| Method | Path        | Purpose                                   |
|-------:|-------------|-------------------------------------------|
| POST   | /api/auth   | Validate password + create session token  |
| GET    | /api/health | Health check                              |

### Socket Events (client -> server)

- `message:send` `{ content, replyTo }`
- `message:edit` `{ messageId, content }`
- `message:delete` `{ messageId }`
- `reaction:toggle` `{ messageId, emoji }`
- `typing:start`
- `typing:stop`

### Socket Events (server -> client)

- `room:state` `{ roomName, messages, users }`
- `presence:update` `{ users }`
- `message:new` `Message`
- `message:updated` `Message`
- `message:reactions` `{ messageId, reactions }`
- `typing:update` `{ users }`
- `room:full`

## Frontend Components

- `LoginForm` - username + password gate
- `ChatPage` - socket setup and state
- `ChatHeader` - room name, status, leave button
- `MessageList` + `MessageItem` - timeline and per-message actions
- `MessageInput` - input bar + reply preview
- `TypingIndicator` - live typing status
- `ReactionBar` - emoji reactions
- `CallPanel` - Metered call embed

## Password-Protected Room Logic

1. User submits username + password to `POST /api/auth`.
2. Server validates password (`ROOM_PASSWORD` default is `0327`).
3. Server issues a one-time `sessionId`.
4. Client connects Socket.io with the sessionId.
5. Server admits only two concurrent connections.

## Metered Integration Steps

1. Create a Metered project and room in the Metered dashboard.
2. Copy the meeting URL or the domain/room slug.
3. Set one of the following in `client/.env`:

```
VITE_METERED_MEETING_URL=https://YOUR_DOMAIN.metered.live/YOUR_ROOM
# or
VITE_METERED_DOMAIN=YOUR_DOMAIN
VITE_METERED_ROOM=YOUR_ROOM
```

4. Start the client. The Call panel will embed Metered for
   voice, video, screen share, mute/unmute, and voice activity detection.

## Data Models (Schema Design)

```ts
User {
  username: string
  joinedAt: string
}

Message {
  id: string
  content: string
  author: string
  timestamp: string
  edited: boolean
  editedAt?: string | null
  deleted?: boolean
  replyTo?: string | null
  reactions: Reaction[]
}

Reaction {
  messageId: string
  emoji: string
  user: string
}

Reply {
  messageId: string
  parentMessageId: string
}
```

## Step-by-Step Build Plan

1. Scaffold React + TypeScript app with Vite.
2. Add Tailwind CSS and design a Discord-inspired layout.
3. Implement login screen with password-protected room entry.
4. Build message list, reply preview, edit/delete, reactions, typing indicator.
5. Create Express server and Socket.io gateway.
6. Add authentication route and socket session check.
7. Wire up client socket events for realtime updates.
8. Embed Metered WebRTC call panel.
9. Document routes, events, and schemas.

## Local Development

### Server

```
cd server
npm install
npm run dev
```

Environment variables (optional):

```
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
ROOM_PASSWORD=0327
ROOM_NAME="Private Duo Room"
```

### Client

```
cd client
npm install
npm run dev
```

Environment variables (optional):

```
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_METERED_MEETING_URL=https://YOUR_DOMAIN.metered.live/YOUR_ROOM
```

## Notes

- The MVP stores messages and presence in memory. Add SQLite or PostgreSQL
  by mapping the schema above if you need persistence.
- Only two concurrent users are allowed in the room.


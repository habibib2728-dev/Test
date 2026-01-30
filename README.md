# ScreenShare Party

Lightweight screen-sharing watch party app built with WebRTC + Socket.IO.

## Features

- One-click room links
- Screen sharing with system audio
- Simple host/viewer flow for watching YouTube or movies together
- Works on Railway or any Node hosting

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:3000`, create a room, and share the link.

## Usage tips

- Use Chrome for the best system audio capture.
- In the screen picker, enable **Share audio**.
- The viewer may need to click the video once to enable audio playback.

## Deploy to Railway

1. Create a new Railway project from this repo.
2. Ensure the start command is `npm start`.
3. Railway will provide `PORT`, which the server already uses.

## Notes

This app uses public STUN servers. If two peers are behind strict NATs, a TURN
server may be required for reliable connectivity.

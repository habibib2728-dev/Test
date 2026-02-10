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
- For a single-page share with audio, choose **Chrome tab** in the picker.
- Use the quality dropdown for 720p60 or 1080p options.

## Deploy to Railway

1. Create a new Railway project from this repo.
2. Ensure the start command is `npm start`.
3. Railway will provide `PORT`, which the server already uses.

## Configure TURN (required for different networks)

For reliable connections across different networks/browsers, add TURN
credentials in Railway:

- `TURN_URLS` (comma-separated URLs)
- `TURN_USERNAME`
- `TURN_CREDENTIAL`

Optional:

- `STUN_URLS` (comma-separated STUN URLs)

Example (Metered or Twilio values):

```
TURN_URLS=turn:example.turn.com:80,turns:example.turn.com:443?transport=tcp
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-credential
```

Note: The app uses only the first STUN URL and first two TURN URLs to avoid
slow ICE discovery warnings.

## Twilio TURN (recommended)

Twilio issues short-lived TURN credentials. Set these env vars in Railway:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TTL=3600
```

When Twilio is configured, the app will fetch fresh TURN credentials from
`/turn` automatically. Do not commit secrets to the repo.

## Notes

This app uses public STUN servers. If two peers are behind strict NATs, a TURN
server may be required for reliable connectivity.

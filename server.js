const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const parseEnvUrls = (value) =>
  String(value || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

const buildIceConfig = () => {
  const stunUrls = parseEnvUrls(process.env.STUN_URLS);
  if (stunUrls.length === 0) {
    stunUrls.push('stun:stun.l.google.com:19302');
  }

  const turnUrls = parseEnvUrls(
    process.env.TURN_URLS || process.env.TURN_URL
  );
  const username = process.env.TURN_USERNAME || process.env.TURN_USER;
  const credential =
    process.env.TURN_CREDENTIAL ||
    process.env.TURN_PASSWORD ||
    process.env.TURN_PASS;

  const iceServers = [];
  if (stunUrls.length) {
    iceServers.push({ urls: stunUrls });
  }

  const turnConfigured = Boolean(
    turnUrls.length && username && credential
  );

  if (turnConfigured) {
    iceServers.push({
      urls: turnUrls,
      username,
      credential,
    });
  }

  return { iceServers, turnConfigured };
};

const iceConfig = buildIceConfig();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(iceConfig);
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const normalizeRoomId = (roomId) =>
  String(roomId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 24);

const leaveRoom = (socket) => {
  const { roomId, role } = socket.data || {};
  if (!roomId) {
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  room.peers.delete(socket.id);
  socket.leave(roomId);

  if (role === 'host') {
    socket.to(roomId).emit('host-left');
    rooms.delete(roomId);
  } else {
    socket.to(roomId).emit('viewer-left');
    if (room.peers.size === 0) {
      rooms.delete(roomId);
    }
  }

  socket.data.roomId = null;
  socket.data.role = null;
};

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId }) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    if (!normalizedRoomId) {
      socket.emit('error-message', {
        message: 'Room ID is required.',
      });
      return;
    }

    const existingRoom = rooms.get(normalizedRoomId);
    if (!existingRoom) {
      rooms.set(normalizedRoomId, {
        hostId: socket.id,
        peers: new Set([socket.id]),
      });
      socket.join(normalizedRoomId);
      socket.data.roomId = normalizedRoomId;
      socket.data.role = 'host';
      socket.emit('room-joined', {
        roomId: normalizedRoomId,
        role: 'host',
      });
      return;
    }

    if (existingRoom.peers.size >= 2) {
      socket.emit('room-full');
      return;
    }

    existingRoom.peers.add(socket.id);
    socket.join(normalizedRoomId);
    socket.data.roomId = normalizedRoomId;
    socket.data.role = 'viewer';
    socket.emit('room-joined', {
      roomId: normalizedRoomId,
      role: 'viewer',
    });
    io.to(existingRoom.hostId).emit('viewer-joined');
  });

  socket.on('leave-room', () => {
    leaveRoom(socket);
  });

  socket.on('webrtc-offer', ({ roomId, offer }) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    if (!normalizedRoomId || !offer) {
      return;
    }
    socket.to(normalizedRoomId).emit('webrtc-offer', { offer });
  });

  socket.on('webrtc-answer', ({ roomId, answer }) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    if (!normalizedRoomId || !answer) {
      return;
    }
    socket.to(normalizedRoomId).emit('webrtc-answer', { answer });
  });

  socket.on('webrtc-ice', ({ roomId, candidate }) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    if (!normalizedRoomId || !candidate) {
      return;
    }
    socket.to(normalizedRoomId).emit('webrtc-ice', { candidate });
  });

  socket.on('share-stopped', ({ roomId }) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    if (!normalizedRoomId) {
      return;
    }
    socket.to(normalizedRoomId).emit('share-stopped');
  });

  socket.on('request-offer', ({ roomId }) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    if (!normalizedRoomId) {
      return;
    }
    const room = rooms.get(normalizedRoomId);
    if (!room) {
      return;
    }
    io.to(room.hostId).emit('request-offer');
  });

  socket.on('disconnect', () => {
    leaveRoom(socket);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});

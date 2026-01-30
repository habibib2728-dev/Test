const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const HOST_GRACE_MS = 120000;

const parseEnvUrls = (value) =>
  String(value || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

const uniqueUrls = (urls) => {
  const seen = new Set();
  return urls.filter((url) => {
    if (seen.has(url)) {
      return false;
    }
    seen.add(url);
    return true;
  });
};

const buildIceConfig = () => {
  const stunUrls = uniqueUrls(parseEnvUrls(process.env.STUN_URLS));
  if (stunUrls.length === 0) {
    stunUrls.push('stun:stun.l.google.com:19302');
  }
  const limitedStunUrls = stunUrls.slice(0, 1);

  const turnUrls = uniqueUrls(
    parseEnvUrls(
    process.env.TURN_URLS || process.env.TURN_URL
    )
  );
  const username = process.env.TURN_USERNAME || process.env.TURN_USER;
  const credential =
    process.env.TURN_CREDENTIAL ||
    process.env.TURN_PASSWORD ||
    process.env.TURN_PASS;
  const limitedTurnUrls = turnUrls.slice(0, 2);

  const iceServers = [];
  if (limitedStunUrls.length) {
    iceServers.push({ urls: limitedStunUrls });
  }

  const turnConfigured = Boolean(
    limitedTurnUrls.length && username && credential
  );

  if (turnConfigured) {
    iceServers.push({
      urls: limitedTurnUrls,
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

const isHostConnected = (room) =>
  room.hostId && room.peers.has(room.hostId);

const clearRoomTimer = (room) => {
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
};

const scheduleRoomCleanup = (roomId, room) => {
  clearRoomTimer(room);
  room.cleanupTimer = setTimeout(() => {
    const currentRoom = rooms.get(roomId);
    if (!currentRoom) {
      return;
    }
    if (isHostConnected(currentRoom)) {
      return;
    }
    if (currentRoom.peers.size > 0) {
      io.to(roomId).emit('host-left');
    }
    rooms.delete(roomId);
  }, HOST_GRACE_MS);
};

const leaveRoom = (socket, { isDisconnect = false } = {}) => {
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
    if (isDisconnect) {
      room.hostId = null;
      if (room.peers.size === 0) {
        rooms.delete(roomId);
      } else {
        socket.to(roomId).emit('host-disconnected');
        scheduleRoomCleanup(roomId, room);
      }
    } else {
      socket.to(roomId).emit('host-left');
      rooms.delete(roomId);
    }
  } else {
    socket.to(roomId).emit('viewer-left');
    if (room.peers.size === 0 && !room.hostId) {
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

    let room = rooms.get(normalizedRoomId);
    if (!room) {
      room = {
        hostId: socket.id,
        peers: new Set(),
        cleanupTimer: null,
      };
      rooms.set(normalizedRoomId, room);
    }

    const hostConnected = isHostConnected(room);
    const shouldBeHost = !hostConnected;

    if (!shouldBeHost && room.peers.size >= 2) {
      socket.emit('room-full');
      return;
    }

    room.peers.add(socket.id);
    socket.join(normalizedRoomId);
    socket.data.roomId = normalizedRoomId;
    socket.data.role = shouldBeHost ? 'host' : 'viewer';

    if (shouldBeHost) {
      room.hostId = socket.id;
      clearRoomTimer(room);
      socket.emit('room-joined', {
        roomId: normalizedRoomId,
        role: 'host',
      });
      if (room.peers.size > 1) {
        socket.emit('viewer-joined');
        socket.to(normalizedRoomId).emit('host-reconnected');
      }
    } else {
      socket.emit('room-joined', {
        roomId: normalizedRoomId,
        role: 'viewer',
      });
      if (room.hostId) {
        io.to(room.hostId).emit('viewer-joined');
      }
    }
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
    if (!room.hostId) {
      return;
    }
    io.to(room.hostId).emit('request-offer');
  });

  socket.on('disconnect', () => {
    leaveRoom(socket, { isDisconnect: true });
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});

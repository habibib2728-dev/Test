const socket = io();

const roomInput = document.getElementById('roomInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const startShareBtn = document.getElementById('startShareBtn');
const stopShareBtn = document.getElementById('stopShareBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const roomDisplay = document.getElementById('roomDisplay');
const roleDisplay = document.getElementById('roleDisplay');
const connectionDisplay = document.getElementById('connectionDisplay');
const statusBadge = document.getElementById('statusBadge');
const screenVideo = document.getElementById('screenVideo');
const videoPlaceholder = document.getElementById('videoPlaceholder');
const videoShell = document.getElementById('videoShell');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const volumeRange = document.getElementById('volumeRange');
const volumeValue = document.getElementById('volumeValue');

const state = {
  roomId: null,
  role: null,
  peerConnection: null,
  localStream: null,
  remoteStream: null,
  viewerConnected: false,
  isSharing: false,
  lastRestartAt: 0,
};

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
const RESTART_COOLDOWN_MS = 5000;

const setStatus = (message, type = 'info') => {
  statusBadge.textContent = message;
  statusBadge.dataset.type = type;
};

const setConnectionText = (message) => {
  connectionDisplay.textContent = message;
};

const normalizeRoomId = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 24);

const updateRoomLink = () => {
  if (!state.roomId) {
    roomDisplay.textContent = 'Not connected';
    return;
  }
  roomDisplay.textContent = state.roomId;
  const url = new URL(window.location.href);
  url.searchParams.set('room', state.roomId);
  window.history.replaceState({}, '', url);
};

const updateUI = () => {
  const inRoom = Boolean(state.roomId);
  const isHost = state.role === 'host';
  startShareBtn.disabled = !inRoom || !isHost || state.isSharing;
  stopShareBtn.disabled = !state.isSharing;
  copyLinkBtn.disabled = !inRoom;
  leaveRoomBtn.disabled = !inRoom;
  createRoomBtn.disabled = inRoom;
  joinRoomBtn.disabled = inRoom;
  roomInput.disabled = inRoom;
  roleDisplay.textContent = state.role ? state.role : 'Not connected';
  if (!inRoom) {
    setConnectionText('Waiting for a room');
  }
  fullscreenBtn.disabled = !screenVideo.srcObject;
};

const attachStream = (stream, isLocal) => {
  screenVideo.srcObject = stream;
  screenVideo.muted = isLocal;
  videoPlaceholder.style.display = 'none';
  screenVideo.play().catch(() => {
    setStatus('Click the video to start audio.', 'warning');
  });
  updateUI();
};

const clearStream = () => {
  screenVideo.srcObject = null;
  videoPlaceholder.style.display = 'flex';
  updateUI();
};

const closePeerConnection = () => {
  if (state.peerConnection) {
    state.peerConnection.ontrack = null;
    state.peerConnection.onicecandidate = null;
    state.peerConnection.onconnectionstatechange = null;
    state.peerConnection.close();
    state.peerConnection = null;
  }
  state.remoteStream = null;
};

const requestReconnect = async () => {
  if (!state.roomId) return;
  const now = Date.now();
  if (now - state.lastRestartAt < RESTART_COOLDOWN_MS) {
    return;
  }
  state.lastRestartAt = now;
  if (state.role === 'host' && state.isSharing) {
    await createOffer({ iceRestart: true });
  } else {
    socket.emit('request-offer', { roomId: state.roomId });
  }
};

const createPeerConnection = () => {
  closePeerConnection();
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onicecandidate = (event) => {
    if (event.candidate && state.roomId) {
      socket.emit('webrtc-ice', {
        roomId: state.roomId,
        candidate: event.candidate,
      });
    }
  };
  pc.onconnectionstatechange = () => {
    const stateLabel = pc.connectionState;
    if (stateLabel === 'connected') {
      setStatus('Connected and streaming', 'success');
    } else if (stateLabel === 'disconnected') {
      setStatus('Connection lost. Reconnecting...', 'warning');
      requestReconnect();
    } else if (stateLabel === 'failed') {
      setStatus('Connection failed. Reconnecting...', 'warning');
      requestReconnect();
    }
  };
  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      state.remoteStream = stream;
      attachStream(stream, false);
    } else {
      if (!state.remoteStream) {
        state.remoteStream = new MediaStream();
      }
      state.remoteStream.addTrack(event.track);
      attachStream(state.remoteStream, false);
    }
  };
  state.peerConnection = pc;
  return pc;
};

const createOffer = async (options = {}) => {
  if (!state.localStream) {
    setStatus('Start screen sharing first.', 'warning');
    return;
  }
  const pc = createPeerConnection();
  state.localStream.getTracks().forEach((track) => {
    pc.addTrack(track, state.localStream);
  });
  const offer = await pc.createOffer(options);
  await pc.setLocalDescription(offer);
  socket.emit('webrtc-offer', { roomId: state.roomId, offer });
};

const startShare = async () => {
  if (state.isSharing) return;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: true,
    });
    state.localStream = stream;
    state.isSharing = true;
    attachStream(stream, true);
    setStatus('Sharing your screen', 'success');
    updateUI();

    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        stopShare(false);
      });
    });

    if (state.viewerConnected) {
      await createOffer();
    } else {
      setConnectionText('Waiting for your viewer to join');
    }
  } catch (err) {
    setStatus('Screen share was cancelled or blocked.', 'error');
  }
};

const stopShare = (notifyPeer = true) => {
  if (!state.isSharing) return;
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
  }
  state.localStream = null;
  state.isSharing = false;
  closePeerConnection();
  clearStream();
  if (notifyPeer && state.roomId) {
    socket.emit('share-stopped', { roomId: state.roomId });
  }
  setStatus('Screen sharing stopped', 'warning');
  updateUI();
};

const leaveRoom = () => {
  if (state.roomId) {
    socket.emit('leave-room');
  }
  stopShare(false);
  closePeerConnection();
  state.roomId = null;
  state.role = null;
  state.viewerConnected = false;
  updateRoomLink();
  updateUI();
  setStatus('Left the room', 'info');
  setConnectionText('Waiting for a room');
};

const joinRoom = (roomId) => {
  const normalized = normalizeRoomId(roomId);
  if (!normalized) {
    setStatus('Enter a valid room ID.', 'warning');
    return;
  }
  socket.emit('join-room', { roomId: normalized });
  setStatus('Joining room...', 'info');
};

const createRoom = () => {
  const randomId = normalizeRoomId(Math.random().toString(36).slice(2, 10));
  roomInput.value = randomId;
  joinRoom(randomId);
};

const copyLink = async () => {
  if (!state.roomId) return;
  const url = new URL(window.location.href);
  url.searchParams.set('room', state.roomId);
  try {
    await navigator.clipboard.writeText(url.toString());
    setStatus('Invite link copied to clipboard', 'success');
  } catch (err) {
    setStatus('Unable to copy link. Copy it manually.', 'warning');
  }
};

createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', () => joinRoom(roomInput.value));
copyLinkBtn.addEventListener('click', copyLink);
startShareBtn.addEventListener('click', startShare);
stopShareBtn.addEventListener('click', () => stopShare(true));
leaveRoomBtn.addEventListener('click', leaveRoom);
screenVideo.addEventListener('click', () => {
  if (screenVideo.paused && screenVideo.srcObject) {
    screenVideo.play().catch(() => {});
  }
});
fullscreenBtn.addEventListener('click', async () => {
  if (!videoShell) return;
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
  } else {
    await videoShell.requestFullscreen().catch(() => {});
  }
});
volumeRange.addEventListener('input', (event) => {
  const value = Number(event.target.value);
  const volume = Number.isNaN(value) ? 100 : value;
  screenVideo.muted = false;
  screenVideo.volume = Math.min(Math.max(volume / 100, 0), 1);
  volumeValue.textContent = `${volume}%`;
});
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    fullscreenBtn.textContent = 'Exit full screen';
  } else {
    fullscreenBtn.textContent = 'Full screen';
  }
});

socket.on('room-joined', ({ roomId, role }) => {
  state.roomId = roomId;
  state.role = role;
  state.viewerConnected = role === 'viewer';
  updateRoomLink();
  updateUI();
  setStatus(`Connected as ${role}`, 'success');
  if (role === 'host') {
    setConnectionText('Waiting for your viewer to join');
  } else {
    setConnectionText('Waiting for the host to share');
  }
});

socket.on('viewer-joined', async () => {
  state.viewerConnected = true;
  setConnectionText('Viewer connected');
  if (state.isSharing) {
    await createOffer();
  }
});

socket.on('viewer-left', () => {
  state.viewerConnected = false;
  closePeerConnection();
  setConnectionText('Viewer left. Waiting for them to return');
  setStatus('Viewer disconnected', 'warning');
});

socket.on('host-left', () => {
  state.viewerConnected = false;
  closePeerConnection();
  clearStream();
  setConnectionText('Host left the room');
  setStatus('Host disconnected', 'warning');
});

socket.on('room-full', () => {
  setStatus('Room is full. Try another code.', 'error');
});

socket.on('error-message', ({ message }) => {
  setStatus(message || 'Something went wrong.', 'error');
});

socket.on('webrtc-offer', async ({ offer }) => {
  if (!offer) return;
  const pc = createPeerConnection();
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('webrtc-answer', { roomId: state.roomId, answer });
});

socket.on('webrtc-answer', async ({ answer }) => {
  if (!state.peerConnection || !answer) return;
  await state.peerConnection.setRemoteDescription(
    new RTCSessionDescription(answer)
  );
});

socket.on('webrtc-ice', async ({ candidate }) => {
  if (!state.peerConnection || !candidate) return;
  try {
    await state.peerConnection.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  } catch (err) {
    setStatus('Could not add ICE candidate.', 'warning');
  }
});

socket.on('share-stopped', () => {
  clearStream();
  closePeerConnection();
  setConnectionText('Host stopped sharing');
  setStatus('Screen share ended', 'warning');
});

socket.on('request-offer', async () => {
  if (state.role === 'host' && state.isSharing) {
    await createOffer({ iceRestart: true });
  }
});

socket.on('disconnect', () => {
  setStatus('Disconnected from server', 'warning');
  updateUI();
});

const initialRoom = new URLSearchParams(window.location.search).get('room');
if (initialRoom) {
  roomInput.value = initialRoom;
  if (socket.connected) {
    joinRoom(initialRoom);
  } else {
    socket.on('connect', () => {
      joinRoom(initialRoom);
    });
  }
}

screenVideo.volume = 1;
volumeRange.value = '100';
volumeValue.textContent = '100%';
updateUI();

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
const qualitySelect = document.getElementById('qualitySelect');
const shareAudioToggle = document.getElementById('shareAudioToggle');

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const state = {
  roomId: null,
  role: null,
  peerConnection: null,
  localStream: null,
  remoteStream: null,
  viewerConnected: false,
  isSharing: false,
  lastRestartAt: 0,
  isMakingOffer: false,
  iceServers: DEFAULT_ICE_SERVERS,
  turnConfigured: false,
  pendingRoomId: null,
};

const RESTART_COOLDOWN_MS = 5000;
let iceConfigPromise = null;

const loadIceConfig = async () => {
  if (iceConfigPromise) {
    return iceConfigPromise;
  }

  iceConfigPromise = fetch('/config', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error('Config unavailable');
      }
      return res.json();
    })
    .then((data) => {
      if (data && Array.isArray(data.iceServers) && data.iceServers.length) {
        state.iceServers = data.iceServers;
      } else {
        state.iceServers = DEFAULT_ICE_SERVERS;
      }
      state.turnConfigured = Boolean(data && data.turnConfigured);
    })
    .catch(() => {
      state.iceServers = DEFAULT_ICE_SERVERS;
      state.turnConfigured = false;
    });

  return iceConfigPromise;
};

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
  if (qualitySelect) {
    qualitySelect.disabled = state.isSharing;
  }
  if (shareAudioToggle) {
    shareAudioToggle.disabled = state.isSharing;
  }
};

const getShareConstraints = () => {
  const quality = qualitySelect ? qualitySelect.value : '720p60';
  let width = 1280;
  let height = 720;
  let frameRate = 60;
  if (quality === '1080p30') {
    width = 1920;
    height = 1080;
    frameRate = 30;
  } else if (quality === '1080p60') {
    width = 1920;
    height = 1080;
    frameRate = 60;
  }

  const audioEnabled = shareAudioToggle ? shareAudioToggle.checked : true;
  return {
    video: {
      width: { ideal: width, max: width },
      height: { ideal: height, max: height },
      frameRate: { ideal: frameRate, max: frameRate },
    },
    audio: audioEnabled
      ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      : false,
  };
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
  state.isMakingOffer = false;
};

const requestReconnect = async () => {
  if (!state.roomId) return;
  const now = Date.now();
  if (now - state.lastRestartAt < RESTART_COOLDOWN_MS) {
    return;
  }
  state.lastRestartAt = now;
  if (state.role === 'host' && state.isSharing) {
    const shouldReset =
      state.peerConnection &&
      (state.peerConnection.connectionState === 'failed' ||
        state.peerConnection.iceConnectionState === 'failed');
    await createOffer({ iceRestart: true }, shouldReset);
  } else {
    socket.emit('request-offer', { roomId: state.roomId });
  }
};

const getPeerConnection = (reset = false) => {
  if (state.peerConnection && !reset) {
    return state.peerConnection;
  }
  closePeerConnection();
  const pc = new RTCPeerConnection({
    iceServers: state.iceServers || DEFAULT_ICE_SERVERS,
  });
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
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed') {
      setStatus('ICE failed. Reconnecting...', 'warning');
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

const syncLocalTracks = (pc) => {
  if (!state.localStream) {
    return;
  }
  const existingSenders = pc.getSenders();
  state.localStream.getTracks().forEach((track) => {
    const alreadyAdded = existingSenders.some(
      (sender) => sender.track && sender.track.id === track.id
    );
    if (!alreadyAdded) {
      pc.addTrack(track, state.localStream);
    }
  });
};

const createOffer = async (options = {}, resetConnection = false) => {
  if (!state.localStream) {
    setStatus('Start screen sharing first.', 'warning');
    return;
  }
  await loadIceConfig();
  const pc = getPeerConnection(resetConnection);
  if (state.isMakingOffer || pc.signalingState !== 'stable') {
    return;
  }
  syncLocalTracks(pc);
  state.isMakingOffer = true;
  try {
    const offer = await pc.createOffer(options);
    await pc.setLocalDescription(offer);
    socket.emit('webrtc-offer', {
      roomId: state.roomId,
      offer: pc.localDescription,
    });
  } catch (err) {
    setStatus('Could not create a connection offer.', 'warning');
  } finally {
    state.isMakingOffer = false;
  }
};

const startShare = async () => {
  if (state.isSharing) return;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia(
      getShareConstraints()
    );
    state.localStream = stream;
    state.isSharing = true;
    attachStream(stream, true);
    setStatus('Sharing your screen', 'success');
    updateUI();

    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        stopShare(true);
      });
    });

    if (shareAudioToggle && shareAudioToggle.checked) {
      const hasAudio = stream.getAudioTracks().length > 0;
      if (!hasAudio) {
        setStatus(
          'No audio track detected. Choose a Chrome tab and enable Share audio.',
          'warning'
        );
      }
    }

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

const emitJoin = (roomId, isReconnect = false) => {
  socket.emit('join-room', { roomId, reconnect: isReconnect });
};

const joinRoom = (roomId) => {
  const normalized = normalizeRoomId(roomId);
  if (!normalized) {
    setStatus('Enter a valid room ID.', 'warning');
    return;
  }
  emitJoin(normalized, false);
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

socket.on('host-disconnected', () => {
  state.viewerConnected = false;
  closePeerConnection();
  clearStream();
  setConnectionText('Host disconnected. Waiting for reconnection');
  setStatus('Host connection lost. Waiting...', 'warning');
});

socket.on('host-reconnected', () => {
  setConnectionText('Host reconnected. Syncing stream');
  setStatus('Host reconnected', 'success');
});

socket.on('room-full', () => {
  setStatus('Room is full. Try another code.', 'error');
});

socket.on('error-message', ({ message }) => {
  setStatus(message || 'Something went wrong.', 'error');
});

socket.on('webrtc-offer', async ({ offer }) => {
  if (!offer) return;
  await loadIceConfig();
  const resetConnection = state.role === 'viewer';
  const pc = getPeerConnection(resetConnection);
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc-answer', {
      roomId: state.roomId,
      answer: pc.localDescription,
    });
  } catch (err) {
    setStatus('Failed to apply the host offer.', 'warning');
  }
});

socket.on('webrtc-answer', async ({ answer }) => {
  if (!state.peerConnection || !answer) return;
  if (state.peerConnection.signalingState !== 'have-local-offer') {
    return;
  }
  try {
    await state.peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  } catch (err) {
    setStatus('Failed to apply the viewer answer.', 'warning');
  }
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
    const shouldReset =
      state.peerConnection &&
      (state.peerConnection.connectionState === 'failed' ||
        state.peerConnection.iceConnectionState === 'failed');
    await createOffer({ iceRestart: true }, shouldReset);
  }
});

socket.on('disconnect', () => {
  setStatus('Disconnected from server', 'warning');
  updateUI();
});

loadIceConfig();

const handleSocketConnect = () => {
  if (state.roomId) {
    emitJoin(state.roomId, true);
    setStatus('Reconnected. Syncing room...', 'info');
    return;
  }
  if (state.pendingRoomId) {
    joinRoom(state.pendingRoomId);
    state.pendingRoomId = null;
  }
};

socket.on('connect', handleSocketConnect);

const initialRoom = new URLSearchParams(window.location.search).get('room');
if (initialRoom) {
  roomInput.value = initialRoom;
  state.pendingRoomId = initialRoom;
}

if (socket.connected) {
  handleSocketConnect();
}

screenVideo.volume = 1;
volumeRange.value = '100';
volumeValue.textContent = '100%';
updateUI();

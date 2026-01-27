import { useEffect, useRef, useState } from 'react'
import { METERED_ROOM_URL } from '../lib/config'

type CallPanelProps = {
  username: string
}

const METERED_SDK_URL = 'https://cdn.metered.ca/sdk/video/1.4.5/sdk.min.js'
let sdkPromise: Promise<void> | null = null

const loadMeteredSdk = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Metered SDK can only load in the browser.'))
  }
  if (window.Metered?.Meeting) {
    return Promise.resolve()
  }
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = METERED_SDK_URL
      script.async = true
      script.onload = () => {
        if (window.Metered?.Meeting) {
          resolve()
        } else {
          reject(new Error('Metered SDK failed to initialize.'))
        }
      }
      script.onerror = () => reject(new Error('Failed to load Metered SDK.'))
      document.head.appendChild(script)
    })
  }
  return sdkPromise
}

type VideoMode = 'off' | 'camera' | 'screen'

const CallPanel = ({ username }: CallPanelProps) => {
  const meetingRef = useRef<any>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  const [status, setStatus] = useState<'idle' | 'loading' | 'joined'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isMicOn, setIsMicOn] = useState(false)
  const [videoMode, setVideoMode] = useState<VideoMode>('off')
  const [activeSpeaker, setActiveSpeaker] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [remoteParticipant, setRemoteParticipant] = useState<{ id: string; name: string } | null>(
    null,
  )

  const roomUrl = METERED_ROOM_URL ?? null

  const resetMedia = () => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
  }

  const handleLeave = async () => {
    const meeting = meetingRef.current
    meetingRef.current = null
    resetMedia()
    setStatus('idle')
    setIsMicOn(false)
    setVideoMode('off')
    setRemoteParticipant(null)
    setActiveSpeaker(null)
    if (meeting) {
      try {
        await meeting.leaveMeeting()
      } catch (leaveError) {
        // Ignore leave errors so UI can reset cleanly.
      }
    }
  }

  useEffect(() => {
    return () => {
      void handleLeave()
    }
  }, [])

  const handleJoin = async () => {
    if (!roomUrl) {
      setError('Metered room is not configured.')
      return
    }
    if (status === 'loading' || status === 'joined') {
      return
    }
    setError(null)
    setStatus('loading')

    try {
      await loadMeteredSdk()
      const meeting = new window.Metered!.Meeting()
      meetingRef.current = meeting

      meeting.on('localTrackUpdated', (trackItem: any) => {
        if (trackItem.type !== 'video' || !localVideoRef.current) {
          return
        }
        const stream = new MediaStream([trackItem.track])
        localVideoRef.current.srcObject = stream
        void localVideoRef.current.play()
      })

      meeting.on('localTrackStopped', (trackItem: any) => {
        if (trackItem.type === 'video' && localVideoRef.current) {
          localVideoRef.current.srcObject = null
          setVideoMode('off')
        }
      })

      meeting.on('remoteTrackStarted', (trackItem: any) => {
        if (trackItem.participantSessionId === meeting.participantSessionId) {
          return
        }
        const stream = new MediaStream([trackItem.track])
        if (trackItem.type === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream
          void remoteVideoRef.current.play()
        }
        if (trackItem.type === 'audio' && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream
          void remoteAudioRef.current.play()
        }
      })

      meeting.on('remoteTrackStopped', (trackItem: any) => {
        if (trackItem.participantSessionId === meeting.participantSessionId) {
          return
        }
        if (trackItem.type === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null
        }
        if (trackItem.type === 'audio' && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = null
        }
      })

      const updateRemoteParticipant = (participants: any[]) => {
        const remote = participants.find(
          (participant) => participant._id !== meeting.participantSessionId,
        )
        if (remote) {
          setRemoteParticipant({ id: remote._id, name: remote.name ?? 'Guest' })
        } else {
          setRemoteParticipant(null)
        }
      }

      meeting.on('participantJoined', (participantInfo: any) => {
        if (participantInfo._id !== meeting.participantSessionId) {
          setRemoteParticipant({
            id: participantInfo._id,
            name: participantInfo.name ?? 'Guest',
          })
        }
      })

      meeting.on('participantLeft', (participantInfo: any) => {
        if (participantInfo._id !== meeting.participantSessionId) {
          setRemoteParticipant(null)
          setActiveSpeaker((prev) => (prev?.id === participantInfo._id ? null : prev))
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null
          }
        }
      })

      meeting.on('onlineParticipants', (participants: any[]) => {
        updateRemoteParticipant(participants ?? [])
      })

      meeting.on('activeSpeaker', (speaker: any) => {
        const name = speaker.name ?? speaker.participant?.name ?? 'Someone'
        setActiveSpeaker({ id: speaker.participantSessionId, name })
      })

      await meeting.join({ roomURL: roomUrl, name: username })
      setStatus('joined')
    } catch (joinError) {
      const message = joinError instanceof Error ? joinError.message : 'Unable to join call.'
      setError(message)
      setStatus('idle')
      meetingRef.current = null
    }
  }

  const handleToggleMic = async () => {
    const meeting = meetingRef.current
    if (!meeting) {
      return
    }
    try {
      if (isMicOn) {
        await meeting.stopAudio()
        setIsMicOn(false)
      } else {
        await meeting.startAudio()
        setIsMicOn(true)
      }
    } catch (micError) {
      setError('Unable to toggle microphone.')
    }
  }

  const handleToggleCamera = async () => {
    const meeting = meetingRef.current
    if (!meeting) {
      return
    }
    try {
      if (videoMode === 'camera') {
        await meeting.stopVideo()
        setVideoMode('off')
      } else {
        if (videoMode === 'screen') {
          await meeting.stopVideo()
        }
        await meeting.startVideo()
        setVideoMode('camera')
      }
    } catch (cameraError) {
      setError('Unable to toggle camera.')
    }
  }

  const handleToggleScreenShare = async () => {
    const meeting = meetingRef.current
    if (!meeting) {
      return
    }
    try {
      if (videoMode === 'screen') {
        await meeting.stopVideo()
        setVideoMode('off')
      } else {
        if (videoMode === 'camera') {
          await meeting.stopVideo()
        }
        await meeting.startScreenShare()
        setVideoMode('screen')
      }
    } catch (screenError) {
      setError('Unable to toggle screen share.')
    }
  }

  const isJoined = status === 'joined'
  const isLoading = status === 'loading'
  const activeSpeakerId = activeSpeaker?.id
  const localIsActive = activeSpeakerId && meetingRef.current?.participantSessionId === activeSpeakerId
  const remoteIsActive = activeSpeakerId && remoteParticipant?.id === activeSpeakerId

  return (
    <aside className="flex w-full max-w-sm flex-col border-l border-slate-800 bg-slate-950/60">
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Call</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">Metered Video SDK</div>
        <p className="mt-2 text-xs text-slate-400">
          Native voice, camera, screen share, mute, and voice activity detection.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={isJoined ? handleLeave : handleJoin}
            type="button"
            disabled={!roomUrl || isLoading}
          >
            {isJoined ? 'Leave Call' : isLoading ? 'Connecting...' : 'Join Call'}
          </button>
          <div className="rounded-full border border-slate-800 px-3 py-2 text-[10px] uppercase text-slate-400">
            {isJoined ? 'Connected' : 'Offline'}
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!roomUrl && (
          <div className="rounded-lg border border-dashed border-slate-700 p-4 text-xs text-slate-400">
            Add <code className="text-slate-200">VITE_METERED_MEETING_URL</code> or
            <code className="ml-1 text-slate-200">VITE_METERED_DOMAIN</code> +{' '}
            <code className="text-slate-200">VITE_METERED_ROOM</code> to enable the call
            panel.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Remote</div>
          <div
            className={`relative mt-3 flex h-48 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 ${
              remoteIsActive ? 'ring-2 ring-emerald-400' : ''
            }`}
          >
            <video
              ref={remoteVideoRef}
              className="h-full w-full rounded-lg object-cover"
              autoPlay
              playsInline
            />
            {!remoteParticipant && (
              <div className="absolute text-xs text-slate-500">Waiting for partner</div>
            )}
          </div>
          <audio ref={remoteAudioRef} autoPlay />
          <div className="mt-2 text-xs text-slate-400">
            {remoteParticipant ? remoteParticipant.name : 'No one yet'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">You</div>
          <div
            className={`relative mt-3 flex h-40 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 ${
              localIsActive ? 'ring-2 ring-emerald-400' : ''
            }`}
          >
            <video
              ref={localVideoRef}
              className="h-full w-full rounded-lg object-cover"
              autoPlay
              playsInline
              muted
            />
            {videoMode === 'off' && (
              <div className="absolute text-xs text-slate-500">Camera off</div>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {videoMode === 'screen' ? 'Screen sharing' : videoMode === 'camera' ? 'Camera' : 'Idle'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Controls</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <button
              className="rounded-md border border-slate-700 px-3 py-2 text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleToggleMic}
              disabled={!isJoined}
              type="button"
            >
              {isMicOn ? 'Mute' : 'Unmute'}
            </button>
            <button
              className="rounded-md border border-slate-700 px-3 py-2 text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleToggleCamera}
              disabled={!isJoined}
              type="button"
            >
              {videoMode === 'camera' ? 'Camera Off' : 'Camera On'}
            </button>
            <button
              className="rounded-md border border-slate-700 px-3 py-2 text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleToggleScreenShare}
              disabled={!isJoined}
              type="button"
            >
              {videoMode === 'screen' ? 'Stop Share' : 'Share Screen'}
            </button>
            <button
              className="rounded-md border border-slate-700 px-3 py-2 text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleLeave}
              disabled={!isJoined}
              type="button"
            >
              End Call
            </button>
          </div>
          {activeSpeaker && (
            <div className="mt-3 text-xs text-emerald-300">
              Voice activity: {activeSpeaker.name}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export default CallPanel

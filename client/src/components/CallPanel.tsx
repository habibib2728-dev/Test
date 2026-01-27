import { useMemo, useState } from 'react'
import { METERED_MEETING_URL } from '../lib/config'

type CallPanelProps = {
  username: string
}

const CallPanel = ({ username }: CallPanelProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const meetingUrl = useMemo(() => {
    if (!METERED_MEETING_URL) {
      return null
    }
    try {
      const url = new URL(METERED_MEETING_URL)
      url.searchParams.set('name', username)
      return url.toString()
    } catch {
      return null
    }
  }, [username])

  return (
    <aside className="flex w-full max-w-sm flex-col border-l border-slate-800 bg-slate-950/60">
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Call</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">Metered WebRTC</div>
        <p className="mt-2 text-xs text-slate-400">
          Voice, video, screen share, mute, and voice activity detection.
        </p>
        <button
          className="mt-4 w-full rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-400 disabled:opacity-60"
          onClick={() => setIsOpen((prev) => !prev)}
          type="button"
          disabled={!meetingUrl}
        >
          {isOpen ? 'Close Call' : 'Join Call'}
        </button>
      </div>
      <div className="flex-1 p-4">
        {!meetingUrl ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-4 text-xs text-slate-400">
            Add <code className="text-slate-200">VITE_METERED_MEETING_URL</code> or
            <code className="ml-1 text-slate-200">VITE_METERED_DOMAIN</code> +{' '}
            <code className="text-slate-200">VITE_METERED_ROOM</code> to enable the call
            panel.
          </div>
        ) : isOpen ? (
          <iframe
            title="Metered Call"
            src={meetingUrl}
            className="h-full w-full rounded-lg border border-slate-800"
            allow="camera; microphone; display-capture; autoplay; fullscreen"
          />
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
            Call is closed. Click "Join Call" to start.
          </div>
        )}
      </div>
    </aside>
  )
}

export default CallPanel

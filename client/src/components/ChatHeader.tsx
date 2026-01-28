type ChatHeaderProps = {
  roomName: string
  users: string[]
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  callState: 'idle' | 'active'
  onCallStart: () => void
  onCallEnd: () => void
  onLogout: () => void
}

const statusStyles: Record<ChatHeaderProps['connectionStatus'], string> = {
  connecting: 'bg-amber-500/20 text-amber-200',
  connected: 'bg-emerald-500/20 text-emerald-200',
  disconnected: 'bg-rose-500/20 text-rose-200',
  error: 'bg-rose-500/20 text-rose-200',
}

const ChatHeader = ({
  roomName,
  users,
  connectionStatus,
  callState,
  onCallStart,
  onCallEnd,
  onLogout,
}: ChatHeaderProps) => {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-[#0b1324]/90 px-6 py-4 backdrop-blur">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Room</div>
        <div className="text-xl font-semibold text-slate-100">{roomName}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="hidden text-xs text-slate-400 sm:block">
          {users.length}/2 participants
        </div>
        <div className={`rounded-full px-3 py-1 text-xs ${statusStyles[connectionStatus]}`}>
          {connectionStatus}
        </div>
        <button
          className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:border-emerald-400 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onCallStart}
          type="button"
          disabled={callState === 'active'}
        >
          Start Call
        </button>
        <button
          className="rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onCallEnd}
          type="button"
          disabled={callState !== 'active'}
        >
          End Call
        </button>
        <button
          className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
          onClick={onLogout}
          type="button"
        >
          Leave
        </button>
      </div>
    </header>
  )
}

export default ChatHeader

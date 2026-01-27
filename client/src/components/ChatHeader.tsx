type ChatHeaderProps = {
  roomName: string
  users: string[]
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  onLogout: () => void
}

const statusStyles: Record<ChatHeaderProps['connectionStatus'], string> = {
  connecting: 'bg-amber-500/20 text-amber-200',
  connected: 'bg-emerald-500/20 text-emerald-200',
  disconnected: 'bg-rose-500/20 text-rose-200',
  error: 'bg-rose-500/20 text-rose-200',
}

const ChatHeader = ({ roomName, users, connectionStatus, onLogout }: ChatHeaderProps) => {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
      <div>
        <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Room</div>
        <div className="text-lg font-semibold text-slate-100">{roomName}</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden text-xs text-slate-400 sm:block">
          {users.length}/2 participants
        </div>
        <div className={`rounded-full px-3 py-1 text-xs ${statusStyles[connectionStatus]}`}>
          {connectionStatus}
        </div>
        <button
          className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
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

type TypingIndicatorProps = {
  users: string[]
}

const TypingIndicator = ({ users }: TypingIndicatorProps) => {
  if (!users.length) {
    return null
  }

  const label =
    users.length === 1
      ? `${users[0]} is typing...`
      : `${users.slice(0, 2).join(', ')} are typing...`

  return (
    <div className="flex items-center gap-2 px-6 py-2 text-xs text-slate-400">
      <span>{label}</span>
      <span className="flex gap-1">
        <span className="h-1 w-1 animate-pulse rounded-full bg-slate-500" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-slate-500 [animation-delay:150ms]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-slate-500 [animation-delay:300ms]" />
      </span>
    </div>
  )
}

export default TypingIndicator

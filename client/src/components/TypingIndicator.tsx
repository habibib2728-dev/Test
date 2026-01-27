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

  return <div className="px-6 py-2 text-xs text-slate-400">{label}</div>
}

export default TypingIndicator

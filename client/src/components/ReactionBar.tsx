import type { Reaction } from '../types'

type ReactionBarProps = {
  reactions: Reaction[]
  currentUser: string
  onToggle: (emoji: string) => void
}

const ReactionBar = ({ reactions, currentUser, onToggle }: ReactionBarProps) => {
  if (!reactions.length) {
    return null
  }

  const grouped = reactions.reduce<Record<string, Set<string>>>((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = new Set()
    }
    acc[reaction.emoji].add(reaction.user)
    return acc
  }, {})

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {Object.entries(grouped).map(([emoji, users]) => {
        const hasReacted = users.has(currentUser)
        return (
          <button
            key={emoji}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
              hasReacted
                ? 'border-blue-400 bg-blue-500/20 text-blue-200'
                : 'border-slate-700 bg-slate-800 text-slate-200'
            }`}
            onClick={() => onToggle(emoji)}
            type="button"
          >
            <span>{emoji}</span>
            <span>{users.size}</span>
          </button>
        )
      })}
    </div>
  )
}

export default ReactionBar

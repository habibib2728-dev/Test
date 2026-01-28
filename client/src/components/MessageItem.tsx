import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import ReactionBar from './ReactionBar'
import { formatTime } from '../lib/format'
import type { Message } from '../types'

type MessageItemProps = {
  message: Message
  parentMessage?: Message
  currentUser: string
  onReply: (message: Message) => void
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
  onToggleReaction: (messageId: string, emoji: string) => void
  onJoinCall: () => void
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '😢']

const MessageItem = ({
  message,
  parentMessage,
  currentUser,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onJoinCall,
}: MessageItemProps) => {
  const isOwn = message.author === currentUser
  const kind = message.kind ?? 'text'
  const isCall = kind === 'call'
  const canInteract = !message.deleted && !isCall
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)

  useEffect(() => {
    setDraft(message.content)
  }, [message.content])

  const handleSave = () => {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === message.content) {
      setIsEditing(false)
      setDraft(message.content)
      return
    }
    onEdit(message.id, trimmed)
    setIsEditing(false)
  }

  return (
    <div className={`group flex gap-3 animate-fade-up ${isOwn ? 'justify-end' : ''}`}>
      {!isOwn && <Avatar username={message.author} />}
      <div
        className={`min-w-0 max-w-[75%] flex flex-col ${isOwn ? 'items-end text-right' : ''}`}
      >
        <div className={`flex flex-wrap items-baseline gap-2 ${isOwn ? 'justify-end' : ''}`}>
          <span className="text-sm font-semibold text-slate-100">{message.author}</span>
          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
          {message.edited && !message.deleted && !isCall && (
            <span className="text-xs text-slate-500">(edited)</span>
          )}
        </div>
        {parentMessage && !isCall && (
          <div className="mt-1 border-l border-slate-700 pl-2 text-xs text-slate-400">
            Replying to <span className="font-semibold">{parentMessage.author}</span>:{' '}
            {parentMessage.deleted ? 'Message deleted' : parentMessage.content}
          </div>
        )}
        <div className="mt-2">
          {isCall ? (
            <div className="rounded-2xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-left">
              <div className="text-xs uppercase tracking-[0.2em] text-blue-300">Call</div>
              <p className="mt-2 text-sm text-slate-100">
                {message.callStatus === 'ended'
                  ? `${message.author} ended the call.`
                  : `${message.author} started a call.`}
              </p>
              {message.callStatus !== 'ended' && (
                <button
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-400"
                  onClick={onJoinCall}
                  type="button"
                >
                  Join Call
                </button>
              )}
            </div>
          ) : message.deleted ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-sm italic text-slate-500">Message deleted</p>
            </div>
          ) : isEditing ? (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                rows={3}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="flex gap-2 text-xs">
                <button
                  className="rounded-full bg-blue-500 px-3 py-1 text-white hover:bg-blue-400"
                  onClick={handleSave}
                  type="button"
                >
                  Save
                </button>
                <button
                  className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                  onClick={() => {
                    setIsEditing(false)
                    setDraft(message.content)
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                isOwn
                  ? 'bg-blue-500 text-white'
                  : 'border border-slate-800 bg-slate-900/80 text-slate-100'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          )}
        </div>
        {canInteract && (
          <ReactionBar
            reactions={message.reactions}
            currentUser={currentUser}
            onToggle={(emoji) => onToggleReaction(message.id, emoji)}
          />
        )}
        {canInteract && (
          <div className="mt-2 hidden flex-wrap items-center gap-2 text-xs text-slate-400 group-hover:flex">
            <button
              className="rounded-full border border-transparent px-2 py-1 hover:border-slate-700 hover:bg-slate-800"
              onClick={() => onReply(message)}
              type="button"
            >
              Reply
            </button>
            <div className="flex flex-wrap gap-1">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  className="rounded-full border border-transparent px-2 py-1 hover:border-slate-700 hover:bg-slate-800"
                  onClick={() => onToggleReaction(message.id, emoji)}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
            {isOwn && (
              <>
                <button
                  className="rounded-full border border-transparent px-2 py-1 hover:border-slate-700 hover:bg-slate-800"
                  onClick={() => setIsEditing(true)}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="rounded-full border border-transparent px-2 py-1 text-rose-300 hover:border-rose-500/40 hover:bg-rose-500/10"
                  onClick={() => onDelete(message.id)}
                  type="button"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageItem

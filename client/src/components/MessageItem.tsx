import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import ReactionBar from './ReactionBar'
import { formatBytes, formatTime } from '../lib/format'
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

  const attachments = message.attachments ?? []

  return (
    <div className="group flex gap-3 animate-fade-up">
      <Avatar username={message.author} />
      <div className="min-w-0 flex-1">
        <div
          className={`rounded-2xl border p-4 shadow-sm transition ${
            isCall
              ? 'border-emerald-400/40 bg-emerald-500/10'
              : 'border-slate-800 bg-slate-900/70 hover:border-emerald-400/30'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-100">{message.author}</div>
              {parentMessage && !isCall && (
                <div className="mt-1 border-l border-slate-700 pl-2 text-xs text-slate-400">
                  Replying to <span className="font-semibold">{parentMessage.author}</span>:{' '}
                  {parentMessage.deleted
                    ? 'Message deleted'
                    : parentMessage.content
                      ? parentMessage.content
                      : parentMessage.attachments?.length
                        ? 'Attachment'
                        : ''}
                </div>
              )}
            </div>
            <div className="text-xs text-slate-500">
              {formatTime(message.timestamp)}
              {message.edited && !message.deleted && !isCall && (
                <span className="ml-2">(edited)</span>
              )}
            </div>
          </div>
          <div className="mt-3">
            {isCall ? (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-3 text-left">
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Call</div>
                <p className="mt-2 text-sm text-slate-100">
                  {message.callStatus === 'ended'
                    ? `${message.author} ended the call.`
                    : `${message.author} started a call.`}
                </p>
                {message.callStatus !== 'ended' && (
                  <button
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-emerald-400"
                    onClick={onJoinCall}
                    type="button"
                  >
                    Join Call
                  </button>
                )}
              </div>
            ) : message.deleted ? (
              <p className="text-sm italic text-slate-500">Message deleted</p>
            ) : isEditing ? (
              <div className="space-y-2">
                <textarea
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                  rows={3}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <div className="flex gap-2 text-xs">
                  <button
                    className="rounded-full bg-emerald-500 px-3 py-1 text-slate-900 hover:bg-emerald-400"
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
              message.content && (
                <p className="whitespace-pre-wrap text-sm text-slate-100">{message.content}</p>
              )
            )}
          </div>
          {!message.deleted && attachments.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {attachments.map((attachment) => {
                const isImage = attachment.type.startsWith('image/')
                return (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    download={attachment.name}
                    className="group/attachment block rounded-xl border border-slate-800 bg-slate-950/60 p-2 transition hover:border-emerald-400/40"
                  >
                    {isImage ? (
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="h-40 w-full rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center gap-3 text-xs text-slate-400">
                        <span className="text-2xl">📄</span>
                        <span className="max-w-[180px] truncate">{attachment.name}</span>
                        <span>{formatBytes(attachment.size)}</span>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate">{attachment.name}</span>
                      <span>{formatBytes(attachment.size)}</span>
                    </div>
                  </a>
                )
              })}
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

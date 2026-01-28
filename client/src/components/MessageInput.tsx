import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Message } from '../types'

type MessageInputProps = {
  replyTo: Message | null
  onCancelReply: () => void
  onSend: (content: string) => void
  onTypingStart: () => void
  onTypingStop: () => void
  disabled?: boolean
}

const MessageInput = ({
  replyTo,
  onCancelReply,
  onSend,
  onTypingStart,
  onTypingStop,
  disabled,
}: MessageInputProps) => {
  const [value, setValue] = useState('')
  const typingTimeout = useRef<number | null>(null)
  const isTyping = useRef(false)

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        window.clearTimeout(typingTimeout.current)
      }
    }
  }, [])

  const stopTyping = () => {
    if (isTyping.current) {
      onTypingStop()
      isTyping.current = false
    }
  }

  const notifyTyping = () => {
    if (!isTyping.current) {
      onTypingStart()
      isTyping.current = true
    }
    if (typingTimeout.current) {
      window.clearTimeout(typingTimeout.current)
    }
    typingTimeout.current = window.setTimeout(() => {
      stopTyping()
    }, 2000)
  }

  const handleChange = (nextValue: string) => {
    setValue(nextValue)
    if (!nextValue.trim()) {
      stopTyping()
      return
    }
    notifyTyping()
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }
    onSend(trimmed)
    setValue('')
    stopTyping()
  }

  return (
    <div className="border-t border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur">
      {replyTo && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
          <div className="truncate">
            Replying to <span className="font-semibold">{replyTo.author}</span>:{' '}
            {replyTo.deleted ? 'Message deleted' : replyTo.content}
          </div>
          <button
            className="ml-4 text-slate-400 hover:text-slate-200"
            onClick={onCancelReply}
            type="button"
          >
            Cancel
          </button>
        </div>
      )}
      <form className="flex items-center gap-3" onSubmit={handleSubmit}>
        <button
          className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
          disabled={disabled}
          type="button"
        >
          📎
        </button>
        <button
          className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
          disabled={disabled}
          type="button"
        >
          😊
        </button>
        <input
          className="flex-1 rounded-full border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          placeholder="Message..."
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          disabled={disabled}
        />
        <button
          className="rounded-full bg-blue-500 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || !value.trim()}
          type="submit"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default MessageInput

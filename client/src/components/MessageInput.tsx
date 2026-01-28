import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { Attachment, Message } from '../types'
import { formatBytes } from '../lib/format'

type MessageInputProps = {
  replyTo: Message | null
  onCancelReply: () => void
  onSend: (content: string, attachments: Attachment[]) => void
  onTypingStart: () => void
  onTypingStop: () => void
  disabled?: boolean
}

type AttachmentDraft = Attachment & {
  isImage: boolean
}

const MAX_ATTACHMENTS = 4
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

const MessageInput = ({
  replyTo,
  onCancelReply,
  onSend,
  onTypingStart,
  onTypingStop,
  disabled,
}: MessageInputProps) => {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const typingTimeout = useRef<number | null>(null)
  const isTyping = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
    if (!trimmed && attachments.length === 0) {
      return
    }
    onSend(trimmed, attachments)
    setValue('')
    setAttachments([])
    setAttachmentError(null)
    stopTyping()
  }

  const handleAttachmentClick = () => {
    if (disabled) {
      return
    }
    fileInputRef.current?.click()
  }

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Unable to read file.'))
      reader.readAsDataURL(file)
    })

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    if (!files.length) {
      return
    }
    setAttachmentError(null)
    const availableSlots = MAX_ATTACHMENTS - attachments.length
    if (availableSlots <= 0) {
      setAttachmentError(`You can attach up to ${MAX_ATTACHMENTS} files.`)
      return
    }

    const accepted = files.slice(0, availableSlots)
    const validFiles = accepted.filter((file) => file.size <= MAX_ATTACHMENT_BYTES)
    if (validFiles.length !== accepted.length) {
      setAttachmentError('Each file must be under 2MB.')
    }

    const newAttachments = await Promise.all(
      validFiles.map(async (file) => {
        const url = await readFileAsDataUrl(file)
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`
        return {
          id,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          url,
          isImage: file.type.startsWith('image/'),
        }
      }),
    )

    setAttachments((prev) => [...prev, ...newAttachments])
    event.target.value = ''
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="border-t border-slate-800 bg-[#0b1324]/90 px-6 py-4 backdrop-blur">
      {replyTo && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
          <div className="truncate">
            Replying to <span className="font-semibold">{replyTo.author}</span>:{' '}
            {replyTo.deleted
              ? 'Message deleted'
              : replyTo.content
                ? replyTo.content
                : replyTo.attachments?.length
                  ? 'Attachment'
                  : ''}
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
      {attachments.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950"
            >
              {attachment.isImage ? (
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div className="flex h-24 flex-col items-center justify-center gap-2 text-xs text-slate-400">
                  <span className="text-lg">📄</span>
                  <span className="max-w-[120px] truncate">{attachment.name}</span>
                </div>
              )}
              <button
                className="absolute right-2 top-2 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] text-slate-200 opacity-0 transition group-hover:opacity-100"
                onClick={() => handleRemoveAttachment(attachment.id)}
                type="button"
              >
                Remove
              </button>
              <div className="absolute bottom-2 left-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-300">
                {formatBytes(attachment.size)}
              </div>
            </div>
          ))}
        </div>
      )}
      {attachmentError && (
        <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {attachmentError}
        </div>
      )}
      <form className="flex items-center gap-3" onSubmit={handleSubmit}>
        <button
          className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
          disabled={disabled}
          type="button"
          onClick={handleAttachmentClick}
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          multiple
          onChange={handleAttachmentChange}
          disabled={disabled}
        />
        <button
          className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
          disabled={disabled}
          type="button"
        >
          😊
        </button>
        <input
          className="flex-1 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          placeholder="Message..."
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          disabled={disabled}
        />
        <button
          className="rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || (!value.trim() && attachments.length === 0)}
          type="submit"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default MessageInput

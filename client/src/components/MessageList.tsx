import { useEffect, useMemo, useRef } from 'react'
import MessageItem from './MessageItem'
import type { Message } from '../types'

type MessageListProps = {
  messages: Message[]
  currentUser: string
  onReply: (message: Message) => void
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
  onToggleReaction: (messageId: string, emoji: string) => void
}

const MessageList = ({
  messages,
  currentUser,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
}: MessageListProps) => {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const messageMap = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex flex-col gap-6">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            parentMessage={message.replyTo ? messageMap.get(message.replyTo) : undefined}
            currentUser={currentUser}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleReaction={onToggleReaction}
          />
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}

export default MessageList

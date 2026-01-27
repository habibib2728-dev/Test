import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../lib/config'
import type { Message, SessionInfo, User } from '../types'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import TypingIndicator from './TypingIndicator'
import CallPanel from './CallPanel'

type ChatPageProps = {
  session: SessionInfo
  onLogout: () => void
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

const ChatPage = ({ session, onLogout }: ChatPageProps) => {
  const [roomName, setRoomName] = useState(session.roomName)
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)

  const socket = useMemo(
    () =>
      io(SOCKET_URL, {
        auth: { sessionId: session.sessionId },
      }),
    [session.sessionId],
  )

  useEffect(() => {
    const handleConnect = () => {
      setConnectionStatus('connected')
      setError(null)
    }

    const handleDisconnect = () => {
      setConnectionStatus('disconnected')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    socket.on('connect_error', (err) => {
      setConnectionStatus('error')
      setError(err.message)
      if (err.message === 'unauthorized') {
        onLogout()
      }
    })

    socket.on('room:full', () => {
      setError('Room is full. Only two people can join.')
      onLogout()
    })

    socket.on('room:state', (payload: { roomName: string; messages: Message[]; users: User[] }) => {
      setRoomName(payload.roomName)
      setMessages(payload.messages)
      setUsers(payload.users)
    })

    socket.on('presence:update', (payload: { users: User[] }) => {
      setUsers(payload.users)
    })

    socket.on('typing:update', (payload: { users: string[] }) => {
      setTypingUsers(payload.users.filter((user) => user !== session.username))
    })

    socket.on('message:new', (message: Message) => {
      setMessages((prev) => [...prev, message])
    })

    socket.on('message:updated', (message: Message) => {
      setMessages((prev) => prev.map((item) => (item.id === message.id ? message : item)))
    })

    socket.on(
      'message:reactions',
      (payload: { messageId: string; reactions: Message['reactions'] }) => {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === payload.messageId ? { ...item, reactions: payload.reactions } : item,
          ),
        )
      },
    )

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.disconnect()
    }
  }, [onLogout, session.username, socket])

  const handleSend = (content: string) => {
    if (!socket.connected) {
      setError('Not connected.')
      return
    }
    socket.emit(
      'message:send',
      { content, replyTo: replyTo?.id ?? null },
      (response: { ok: boolean; error?: string }) => {
        if (!response.ok) {
          setError(response.error ?? 'Unable to send message.')
        }
      },
    )
    setReplyTo(null)
  }

  const handleEdit = (messageId: string, content: string) => {
    socket.emit('message:edit', { messageId, content }, (response: { ok: boolean; error?: string }) => {
      if (!response.ok) {
        setError(response.error ?? 'Unable to edit message.')
      }
    })
  }

  const handleDelete = (messageId: string) => {
    socket.emit('message:delete', { messageId }, (response: { ok: boolean; error?: string }) => {
      if (!response.ok) {
        setError(response.error ?? 'Unable to delete message.')
      }
    })
  }

  const handleToggleReaction = (messageId: string, emoji: string) => {
    socket.emit(
      'reaction:toggle',
      { messageId, emoji },
      (response: { ok: boolean; error?: string }) => {
        if (!response.ok) {
          setError(response.error ?? 'Unable to react.')
        }
      },
    )
  }

  const handleTypingStart = () => {
    socket.emit('typing:start')
  }

  const handleTypingStop = () => {
    socket.emit('typing:stop')
  }

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-100">
      <ChatHeader
        roomName={roomName}
        users={users.map((user) => user.username)}
        connectionStatus={connectionStatus}
        onLogout={onLogout}
      />
      {error && (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-6 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <section className="flex flex-1 flex-col">
          <MessageList
            messages={messages}
            currentUser={session.username}
            onReply={(message) => setReplyTo(message)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleReaction={handleToggleReaction}
          />
          <TypingIndicator users={typingUsers} />
          <MessageInput
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onSend={handleSend}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            disabled={connectionStatus !== 'connected'}
          />
        </section>
        <CallPanel username={session.username} />
      </div>
    </div>
  )
}

export default ChatPage

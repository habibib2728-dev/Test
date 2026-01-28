import cors from 'cors'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const PORT = process.env.PORT || 3001
const ROOM_PASSWORD = process.env.ROOM_PASSWORD || '0327'
const DEFAULT_ORIGIN = 'http://localhost:5173'
const rawOrigins = process.env.CLIENT_ORIGIN || DEFAULT_ORIGIN
const allowedOrigins = rawOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (!allowedOrigins.length) {
  allowedOrigins.push(DEFAULT_ORIGIN)
}
const ROOM_NAME = process.env.ROOM_NAME || 'Private Duo Room'
const MAX_PARTICIPANTS = 2
const MAX_ATTACHMENTS = 4
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

const app = express()
app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDistPath = path.resolve(__dirname, '../../client/dist')
const clientIndexPath = path.join(clientDistPath, 'index.html')
const hasClientBuild = fs.existsSync(clientIndexPath)
if (hasClientBuild) {
  app.use(express.static(clientDistPath))
}

const sessions = new Map()
const activeUsers = new Map()
const messages = []
const typingUsers = new Map()

const emitPresence = (io) => {
  io.emit('presence:update', {
    users: Array.from(activeUsers.values()),
  })
}

const emitTyping = (io) => {
  io.emit('typing:update', {
    users: Array.from(typingUsers.keys()),
  })
}

const stopTyping = (io, username) => {
  const timeout = typingUsers.get(username)
  if (timeout) {
    clearTimeout(timeout)
    typingUsers.delete(username)
    emitTyping(io)
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth', (req, res) => {
  const { username, password } = req.body ?? {}
  const trimmed = typeof username === 'string' ? username.trim() : ''

  if (!trimmed || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' })
  }

  if (password !== ROOM_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect room password.' })
  }

  if (activeUsers.size >= MAX_PARTICIPANTS) {
    return res.status(403).json({ error: 'Room is full.' })
  }

  const sessionId = randomUUID()
  sessions.set(sessionId, {
    username: trimmed,
    createdAt: new Date().toISOString(),
  })

  return res.json({ sessionId, roomName: ROOM_NAME })
})

if (hasClientBuild) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      next()
      return
    }
    res.sendFile(clientIndexPath)
  })
}

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
})

io.use((socket, next) => {
  const { sessionId } = socket.handshake.auth ?? {}
  if (!sessionId || !sessions.has(sessionId)) {
    return next(new Error('unauthorized'))
  }
  const session = sessions.get(sessionId)
  socket.data.username = session.username
  socket.data.sessionId = sessionId
  sessions.delete(sessionId)
  return next()
})

io.on('connection', (socket) => {
  const username = socket.data.username

  if (activeUsers.size >= MAX_PARTICIPANTS) {
    socket.emit('room:full')
    socket.disconnect(true)
    return
  }

  const user = { username, joinedAt: new Date().toISOString() }
  activeUsers.set(socket.id, user)

  socket.emit('room:state', {
    roomName: ROOM_NAME,
    messages,
    users: Array.from(activeUsers.values()),
  })
  emitPresence(io)

  socket.on('message:send', (payload, ack) => {
    const content = typeof payload?.content === 'string' ? payload.content.trim() : ''
    const rawAttachments = Array.isArray(payload?.attachments) ? payload.attachments : []
    if (rawAttachments.length > MAX_ATTACHMENTS) {
      ack?.({ ok: false, error: `You can attach up to ${MAX_ATTACHMENTS} files.` })
      return
    }

    const attachments = rawAttachments
      .map((attachment) => {
        const name = typeof attachment?.name === 'string' ? attachment.name : null
        const type = typeof attachment?.type === 'string' ? attachment.type : null
        const size = typeof attachment?.size === 'number' ? attachment.size : null
        const url = typeof attachment?.url === 'string' ? attachment.url : null
        const id = typeof attachment?.id === 'string' ? attachment.id : randomUUID()
        if (!name || !type || !size || !url) {
          return null
        }
        if (!url.startsWith('data:')) {
          return null
        }
        if (size > MAX_ATTACHMENT_BYTES) {
          return null
        }
        return { id, name, type, size, url }
      })
      .filter(Boolean)

    if (rawAttachments.length && attachments.length !== rawAttachments.length) {
      ack?.({ ok: false, error: 'Attachments must be under 2MB.' })
      return
    }

    if (!content && attachments.length === 0) {
      ack?.({ ok: false, error: 'Message cannot be empty.' })
      return
    }

    const message = {
      id: randomUUID(),
      content,
      author: username,
      timestamp: new Date().toISOString(),
      edited: false,
      editedAt: null,
      deleted: false,
      replyTo: payload?.replyTo ?? null,
      reactions: [],
      kind: 'text',
      attachments,
    }

    messages.push(message)
    io.emit('message:new', message)
    ack?.({ ok: true })
  })

  socket.on('message:edit', (payload, ack) => {
    const { messageId } = payload ?? {}
    const content = typeof payload?.content === 'string' ? payload.content.trim() : ''
    if (!messageId || !content) {
      ack?.({ ok: false, error: 'Message cannot be empty.' })
      return
    }

    const message = messages.find((item) => item.id === messageId)
    if (!message) {
      ack?.({ ok: false, error: 'Message not found.' })
      return
    }

    if (message.kind !== 'text') {
      ack?.({ ok: false, error: 'Only text messages can be edited.' })
      return
    }

    if (message.author !== username) {
      ack?.({ ok: false, error: 'You can only edit your own messages.' })
      return
    }

    message.content = content
    message.edited = true
    message.editedAt = new Date().toISOString()
    io.emit('message:updated', message)
    ack?.({ ok: true })
  })

  socket.on('message:delete', (payload, ack) => {
    const { messageId } = payload ?? {}
    const message = messages.find((item) => item.id === messageId)
    if (!message) {
      ack?.({ ok: false, error: 'Message not found.' })
      return
    }

    if (message.kind !== 'text') {
      ack?.({ ok: false, error: 'Only text messages can be deleted.' })
      return
    }

    if (message.author !== username) {
      ack?.({ ok: false, error: 'You can only delete your own messages.' })
      return
    }

    message.content = ''
    message.deleted = true
    message.edited = false
    message.editedAt = null
    message.attachments = []
    io.emit('message:updated', message)
    ack?.({ ok: true })
  })

  socket.on('reaction:toggle', (payload, ack) => {
    const { messageId, emoji } = payload ?? {}
    const message = messages.find((item) => item.id === messageId)
    if (!message || typeof emoji !== 'string') {
      ack?.({ ok: false, error: 'Invalid reaction.' })
      return
    }

    if (message.kind !== 'text') {
      ack?.({ ok: false, error: 'Reactions are only supported for text messages.' })
      return
    }

    const existingIndex = message.reactions.findIndex(
      (reaction) => reaction.emoji === emoji && reaction.user === username,
    )

    if (existingIndex >= 0) {
      message.reactions.splice(existingIndex, 1)
    } else {
      message.reactions.push({ emoji, user: username })
    }

    io.emit('message:reactions', {
      messageId: message.id,
      reactions: message.reactions,
    })
    ack?.({ ok: true })
  })

  socket.on('typing:start', () => {
    if (typingUsers.has(username)) {
      clearTimeout(typingUsers.get(username))
    }
    const timeout = setTimeout(() => {
      typingUsers.delete(username)
      emitTyping(io)
    }, 2500)
    typingUsers.set(username, timeout)
    emitTyping(io)
  })

  socket.on('typing:stop', () => {
    stopTyping(io, username)
  })

  socket.on('call:status', (payload, ack) => {
    const status = payload?.status
    if (status !== 'started' && status !== 'ended') {
      ack?.({ ok: false, error: 'Invalid call status.' })
      return
    }

    const message = {
      id: randomUUID(),
      content:
        status === 'started'
          ? `${username} started a call`
          : `${username} ended the call`,
      author: username,
      timestamp: new Date().toISOString(),
      edited: false,
      editedAt: null,
      deleted: false,
      replyTo: null,
      reactions: [],
      kind: 'call',
      callStatus: status,
      attachments: [],
    }

    messages.push(message)
    io.emit('message:new', message)
    ack?.({ ok: true })
  })

  socket.on('disconnect', () => {
    stopTyping(io, username)
    activeUsers.delete(socket.id)
    emitPresence(io)
  })
})

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`)
})

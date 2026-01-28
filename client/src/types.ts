export type User = {
  username: string
  joinedAt: string
}

export type Reaction = {
  emoji: string
  user: string
}

export type Attachment = {
  id: string
  name: string
  type: string
  size: number
  url: string
}

export type MessageKind = 'text' | 'call'
export type CallStatus = 'started' | 'ended'

export type Message = {
  id: string
  content: string
  author: string
  timestamp: string
  edited: boolean
  editedAt?: string | null
  deleted?: boolean
  replyTo?: string | null
  reactions: Reaction[]
  kind?: MessageKind
  callStatus?: CallStatus
  attachments?: Attachment[]
}

export type SessionInfo = {
  sessionId: string
  username: string
  roomName: string
}

export type RoomState = {
  roomName: string
  messages: Message[]
  users: User[]
  typingUsers: string[]
}

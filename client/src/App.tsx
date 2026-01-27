import { useState } from 'react'
import ChatPage from './components/ChatPage'
import LoginForm from './components/LoginForm'
import type { SessionInfo } from './types'

const App = () => {
  const [session, setSession] = useState<SessionInfo | null>(null)

  if (!session) {
    return <LoginForm onSuccess={setSession} />
  }

  return <ChatPage session={session} onLogout={() => setSession(null)} />
}

export default App

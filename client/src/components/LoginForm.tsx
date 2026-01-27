import { useState } from 'react'
import { API_URL } from '../lib/config'
import type { SessionInfo } from '../types'

type LoginFormProps = {
  onSuccess: (session: SessionInfo) => void
}

const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const trimmed = username.trim()
    if (!trimmed || !password.trim()) {
      setError('Enter a username and room password.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed, password }),
      })

      const data = (await response.json()) as { sessionId?: string; roomName?: string; error?: string }
      if (!response.ok || !data.sessionId) {
        throw new Error(data.error ?? 'Unable to join the room.')
      }

      onSuccess({
        sessionId: data.sessionId,
        username: trimmed,
        roomName: data.roomName ?? 'Private Duo Room',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-8 shadow-lg">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Private Duo</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Join the room</h1>
        <p className="mt-2 text-sm text-slate-400">
          Pick any username and enter the shared room password.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Username</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              placeholder="Type your name"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Room password
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              placeholder="0327"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}
          <button
            className="w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Connecting...' : 'Enter room'}
          </button>
        </form>
        <div className="mt-6 text-xs text-slate-500">
          Password is verified server-side. No accounts, no emails.
        </div>
      </div>
    </div>
  )
}

export default LoginForm

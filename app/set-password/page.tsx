'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase-browser'

export default function SetPasswordPage() {
  const s = supabase()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function establishSession() {
      // Supabase may return the invite with an authorization code.
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code) {
        const { error } = await s.auth.exchangeCodeForSession(code)

        if (error) {
          setMessage(`Unable to verify invitation: ${error.message}`)
          return
        }

        // Remove the one-time code from the visible URL.
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        )
      }

      const {
        data: { session }
      } = await s.auth.getSession()

      if (!session) {
        setMessage(
          'Your invitation session could not be verified. Please use the link in your invitation email again.'
        )
        return
      }

      setReady(true)
    }

    establishSession()
  }, [])

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!ready) {
      setMessage(
        'Your invitation is still being verified. Please wait a moment and try again.'
      )
      return
    }

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    setSaving(true)

    const { error } = await s.auth.updateUser({
      password
    })

    setSaving(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Password created successfully. Opening Flatout ERP...')

    setTimeout(() => {
      router.push('/dashboard')
    }, 1000)
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 32,
          background: '#1c1c1c',
          borderRadius: 10,
          color: '#fff'
        }}
      >
        <h1 style={{ marginTop: 0 }}>Create Your Password</h1>

        <p style={{ color: '#aaa' }}>
          Create a password for your Flatout Sim Racing ERP account.
        </p>

        <form onSubmit={setNewPassword}>
          <label>Password</label>

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={!ready || saving}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 6,
              marginBottom: 18,
              boxSizing: 'border-box'
            }}
          />

          <label>Confirm Password</label>

          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            disabled={!ready || saving}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 6,
              marginBottom: 18,
              boxSizing: 'border-box'
            }}
          />

          <button
            type="submit"
            disabled={!ready || saving}
            style={{
              width: '100%',
              padding: 12,
              background: '#E71D36',
              color: '#fff',
              border: 0,
              borderRadius: 5,
              cursor: ready ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              opacity: ready ? 1 : 0.6
            }}
          >
            {!ready
              ? 'Verifying Invitation...'
              : saving
                ? 'Creating Password...'
                : 'Create Password'}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 18 }}>
            {message}
          </p>
        )}
      </div>
    </main>
  )
}

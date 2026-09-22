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
      try {
        // Supabase invitation links currently return the session
        // in the URL hash:
        // #access_token=...&refresh_token=...&type=invite
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        )

        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await s.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (error) {
            setMessage(
              `Unable to verify invitation: ${error.message}`
            )
            return
          }

          // Remove the tokens from the browser address bar.
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          )
        } else {
          // Also support PKCE/code-based redirects if we use them later.
          const searchParams = new URLSearchParams(
            window.location.search
          )

          const code = searchParams.get('code')

          if (code) {
            const { error } =
              await s.auth.exchangeCodeForSession(code)

            if (error) {
              setMessage(
                `Unable to verify invitation: ${error.message}`
              )
              return
            }

            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            )
          }
        }

        const {
          data: { session },
          error: sessionError
        } = await s.auth.getSession()

        if (sessionError || !session) {
          setMessage(
            'Your invitation session could not be verified. Please use a fresh invitation link.'
          )
          return
        }

        setReady(true)
      } catch (error: any) {
        setMessage(
          error?.message || 'Unable to verify invitation.'
        )
      }
    }

    establishSession()
  }, [])

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!ready) {
      setMessage(
        'Your invitation is still being verified. Please wait a moment.'
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

    setMessage(
      'Password created successfully. Opening Flatout ERP...'
    )

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
        <h1 style={{ marginTop: 0 }}>
          Create Your Password
        </h1>

        <p style={{ color: '#aaa' }}>
          Create a password for your Flatout Sim Racing ERP
          account.
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

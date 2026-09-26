'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [message, setMessage] = useState('')
  const [forgotPassword, setForgotPassword] = useState(false)
  const [sending, setSending] = useState(false)

  const r = useRouter()

  async function go(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setMessage('')

    const { error } = await supabase().auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setErr(error.message)
    } else {
      r.push('/dashboard')
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()

    setErr('')
    setMessage('')

    if (!email.trim()) {
      setErr('Enter your email address.')
      return
    }

    setSending(true)

   const response = await fetch('/api/forgot-password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: email.trim()
  })
})

const result = await response.json()

setSending(false)

if (!response.ok) {
  setErr('Unable to process password reset. Please try again.')
  return
}

setMessage(
  result.message ||
    'If an ERP account exists for that email, a password reset link has been sent.'
)

  return (
    <div className="login">
      <form
        className="loginbox"
        onSubmit={forgotPassword ? resetPassword : go}
      >
        <img src="/flatout-logo.svg" />

        <h1>FLATOUT ERP</h1>

        <p className="muted">
          {forgotPassword
            ? 'Reset your ERP password'
            : 'Internal operations system'}
        </p>

        <div className="field">
          <label>Email</label>

          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>

        {!forgotPassword && (
          <div className="field">
            <label>Password</label>

            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              required
            />

            <div
              style={{
                textAlign: 'right',
                marginTop: 8
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setForgotPassword(true)
                  setErr('')
                  setMessage('')
                }}
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  color: '#666',
                  textDecoration: 'underline'
                }}
              >
                Forgot password?
              </button>
            </div>
          </div>
        )}

        {err && (
          <p style={{ color: '#b42318' }}>
            {err}
          </p>
        )}

        {message && (
          <p>
            {message}
          </p>
        )}

        <button
          className="btn"
          style={{ width: '100%' }}
          disabled={sending}
        >
          {forgotPassword
            ? sending
              ? 'SENDING...'
              : 'SEND RESET LINK'
            : 'LOG IN'}
        </button>

        {forgotPassword && (
          <button
            type="button"
            className="btn secondary"
            style={{
              width: '100%',
              marginTop: 10
            }}
            onClick={() => {
              setForgotPassword(false)
              setErr('')
              setMessage('')
            }}
          >
            BACK TO LOGIN
          </button>
        )}
      </form>
    </div>
  )
}

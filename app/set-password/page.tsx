'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase-browser'

export default function SetPasswordPage() {
  const s = supabase()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

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

    setMessage('Password created successfully.')

    setTimeout(() => {
      router.push('/dashboard')
    }, 1000)
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#111'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        padding: 32,
        background: '#1c1c1c',
        borderRadius: 10,
        color: '#fff'
      }}>
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
            disabled={saving}
            style={{
              width: '100%',
              padding: 12,
              background: '#E71D36',
              color: '#fff',
              border: 0,
              borderRadius: 5,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {saving ? 'Creating Password...' : 'Create Password'}
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

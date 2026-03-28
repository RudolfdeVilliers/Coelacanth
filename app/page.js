'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function WaitlistPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [position, setPosition] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.')
      }

      setPosition(data.position)
      setStatus('success')
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px 80px',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative',
    }}>

      {/* Brand name */}
      <p style={{
        color: '#4bd4c7',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        marginBottom: '8px',
        fontFamily: "'Montserrat', sans-serif",
      }}>
        Coelacanth
      </p>

      {/* Headline */}
      <h1 style={{
        color: '#4bd4c7',
        fontSize: '40px',
        fontWeight: 700,
        margin: '0 0 16px',
        textAlign: 'center',
        lineHeight: 1.15,
        fontFamily: "'Montserrat', sans-serif",
      }}>
        One Coelacanth. Many apps.
      </h1>

      {/* Subheadline */}
      <p style={{
        color: '#4bd4c7',
        fontSize: '16px',
        maxWidth: '460px',
        textAlign: 'center',
        lineHeight: 1.65,
        margin: '0 0 36px',
        fontFamily: "'Montserrat', sans-serif",
      }}>
        Coelacanth makes switching between apps extinct.
      </p>

      {/* Fish */}
      <div className="fish-bob" style={{ marginBottom: '24px' }}>
        <div className="fish-wrap">
          <Image
            src="/coelacanth.png"
            alt="Coelacanth"
            width={280}
            height={280}
            style={{ width: '280px', height: 'auto', display: 'block' }}
            priority
          />
        </div>
      </div>

      {/* Form or success */}
      {status === 'success' ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{
            color: '#083470',
            fontSize: '18px',
            fontWeight: 500,
            display: 'inline-block',
          }}>
            You&apos;re on the list.
            <span style={{
              display: 'block',
              height: '2px',
              background: '#5ce1e6',
              borderRadius: '2px',
              marginTop: '6px',
            }} />
          </p>
          {position && (
            <p style={{ color: '#5d879a', fontSize: '13px', marginTop: '10px' }}>
              You&apos;re #{position} in line.
            </p>
          )}
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '520px',
          }}
        >
          <input
            type="email"
            required
            placeholder="your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={status === 'loading'}
            style={{
              border: '1.5px solid #5ce1e6',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '14px',
              width: '280px',
              outline: 'none',
              fontFamily: "'DM Sans', sans-serif",
              color: '#083470',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = '#083470' }}
            onBlur={e => { e.target.style.borderColor = '#5ce1e6' }}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              background: '#F7FE4F',
              color: '#083470',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '8px',
              padding: '12px 24px',
              border: 'none',
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              opacity: status === 'loading' ? 0.7 : 1,
              transition: 'opacity 0.15s, background 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (status !== 'loading') e.target.style.background = '#e8ef00' }}
            onMouseLeave={e => { e.target.style.background = '#F7FE4F' }}
          >
            {status === 'loading' ? 'Joining…' : 'Join the waitlist'}
          </button>

          {status === 'error' && (
            <p style={{
              width: '100%',
              textAlign: 'center',
              color: '#c0392b',
              fontSize: '13px',
              marginTop: '4px',
            }}>
              {errorMsg}
            </p>
          )}

          {/* Small print */}
          <p style={{
            width: '100%',
            textAlign: 'center',
            fontSize: '11px',
            color: '#5d879a',
            fontStyle: 'italic',
            maxWidth: '380px',
            margin: '8px auto 0',
            lineHeight: 1.5,
          }}>
            Be one of the 410 to sign up and receive exclusive pricing
            and priority access for their first year.
          </p>
        </form>
      )}

      {/* Mobile */}
      <style>{`
        @media (max-width: 480px) {
          form {
            flex-direction: column !important;
            align-items: center !important;
          }
          form input {
            width: 100% !important;
            max-width: 320px;
          }
          form button {
            width: 100% !important;
            max-width: 320px;
          }
        }
      `}</style>

    </main>
  )
}

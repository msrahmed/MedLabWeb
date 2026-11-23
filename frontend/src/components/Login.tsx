
import { useState, type FormEvent } from 'react'
import { Activity, LockKeyhole, User, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import './Login.css'

const API = 'http://127.0.0.1:8000'

export interface AuthUser {
  id: number
  username: string
  full_name: string | null
  email: string | null
  role: number
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

interface LoginProps {
  onLogin: (result: LoginResponse) => void
}

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.detail === 'PASSWORD_EXPIRED') {
          throw new Error('Your password has expired. Please contact an administrator.')
        }

        if (response.status === 401) {
          throw new Error('Incorrect username or password.')
        }

        throw new Error(
          typeof result.detail === 'string'
            ? result.detail
            : 'Login failed. Please try again.'
        )
      }

      onLogin(result as LoginResponse)

    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to connect to the server.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-brand">
          <div className="login-brand-icon">
            <Activity size={27} />
          </div>
          <div>
            <h1>MedLab</h1>
            <span>LABORATORY MANAGEMENT</span>
          </div>
        </div>

        <div className="login-heading">
          <h2>Welcome back</h2>
          <p>Sign in to access your laboratory workspace.</p>
        </div>

        <form onSubmit={handleSubmit}>

          <label htmlFor="username">Username</label>
          <div className="login-input">
            <User size={18} />
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={event => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <label htmlFor="password">Password</label>
          <div className="login-input">
            <LockKeyhole size={18} />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle size={18} className="login-spinner" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>

        </form>

        <div className="login-footer">
          Secure laboratory administration
        </div>

      </div>
    </div>
  )
}

export default Login

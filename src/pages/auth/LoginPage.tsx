import type { FormEvent } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface LoginLocationState {
  from?: string;
}

/**
 * Private email-and-password sign-in page for the two approved accounts.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, authError, clearAuthError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const locationState = location.state as LoginLocationState | null;
  const destination = locationState?.from ?? '/';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    clearAuthError();

    try {
      await signIn(email, password);
      navigate(destination, { replace: true });
    } catch {
      // The context stores the friendly Supabase authentication message.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-card__mark" aria-hidden="true">
          <span>♥</span>
        </div>

        <p className="auth-card__eyebrow">A private place for two</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="auth-card__intro">
          Sign in to save the next place, plan the next date, or leave something sweet.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          {authError ? (
            <p className="form-message form-message--error" role="alert">
              {authError}
            </p>
          ) : null}

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-card__privacy">Access is limited to your two approved accounts.</p>
      </section>
    </main>
  );
}

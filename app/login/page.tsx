'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Mode = 'login' | 'register';

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
    setConfirm('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isRegister) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(isRegister ? '/api/register' : '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || (isRegister ? 'Could not create account.' : 'Could not log in.'));
        return;
      }

      router.push(from);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'w-full border border-thread/40 bg-transparent px-3 py-2 text-sm text-canvas placeholder:text-thread/50 focus:border-marigold focus:outline-none';

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm border border-thread/30 bg-ink px-8 py-10"
      >
        <h1 className="font-display text-3xl italic text-canvas">Fitting Room</h1>
        <p className="mt-2 text-sm text-thread">
          {isRegister ? 'Create an account to get started.' : 'Sign in to continue.'}
        </p>

        <div className="mt-6 grid grid-cols-2 border border-thread/30 text-sm" role="tablist">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`py-2 transition-colors ${
                mode === m ? 'bg-maroon text-canvas' : 'text-thread hover:text-marigold'
              }`}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm text-thread">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={isRegister ? 3 : undefined}
              maxLength={30}
              className={inputClass}
            />
            {isRegister && (
              <p className="mt-1 text-xs text-thread/70">
                3–30 characters: letters, numbers, . - _
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-thread">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isRegister ? 8 : undefined}
              className={inputClass}
            />
            {isRegister && <p className="mt-1 text-xs text-thread/70">At least 8 characters.</p>}
          </div>

          {isRegister && (
            <div>
              <label htmlFor="confirm" className="mb-1 block text-sm text-thread">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-marigold" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full bg-maroon py-3 text-sm text-canvas transition-colors hover:bg-marigold hover:text-ink disabled:cursor-not-allowed disabled:bg-thread/20 disabled:text-thread"
        >
          {isSubmitting
            ? isRegister
              ? 'Creating account…'
              : 'Signing in…'
            : isRegister
              ? 'Create account'
              : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

// useSearchParams requires a Suspense boundary in the App Router.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}

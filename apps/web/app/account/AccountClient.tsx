'use client';
import { useEffect, useState, type JSX } from 'react';

export default function AccountClient({ status }: { status?: string | undefined }): JSX.Element {
  const [accountId, setAccountId] = useState<string | null | undefined>();
  useEffect(() => {
    fetch('/api/account/session')
      .then(response => response.ok ? response.json() : { accountId: null })
      .then(value => setAccountId((value as { accountId?: string | null }).accountId ?? null))
      .catch(() => setAccountId(null));
  }, []);
  return <main style={{ maxWidth: 480, margin: '3rem auto', padding: '1rem' }}>
    <h1>Initial Baseball account</h1>
    {status === 'sent' && <p>If the address is eligible, a sign-in code has been sent. Enter it below.</p>}
    {status === 'invalid' && <p>That sign-in attempt could not be verified. Please try again.</p>}
    {status === 'unavailable' && <p>Sign-in is temporarily unavailable. Please try again later.</p>}
    {accountId === undefined ? <p>Checking account…</p> : accountId ? <>
      <p>Signed in. Creator saving will be available after account ownership is enabled.</p>
      <form method="post" action="/api/account/auth/signout"><button type="submit">Sign out</button></form>
    </> : <>
      <p>Sign in to save and share a Custom Lineup. You can still play Daily Nine and issued Custom games as a guest.</p>
      <form method="post" action="/api/account/auth/start">
        <button name="provider" value="google" type="submit">Continue with Google</button>{' '}
        <button name="provider" value="apple" type="submit">Continue with Apple</button>
      </form>
      <form method="post" action="/api/account/auth/start">
        <input type="hidden" name="provider" value="email" />
        <label>Email <input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <button type="submit">Send code</button>
      </form>
      <form method="post" action="/api/account/auth/verify">
        <label>Email <input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>Six-digit code <input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label>
        <button type="submit">Verify code</button>
      </form>
    </>}
  </main>;
}

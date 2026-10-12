'use client';

import { useState } from 'react';

/**
 * Notify-me capture with no backend behind it.
 *
 * The address is validated client-side and kept in this browser only, and
 * the confirmation says exactly that. A control that pretended to subscribe
 * would promise a delivery no transport exists to make.
 */
const KEY = 'correnthian-notify';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NotifyForm() {
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(() => {
    try {
      return window.localStorage.getItem(KEY) !== null;
    } catch {
      return false;
    }
  });
  const valid = EMAIL.test(email.trim());

  return (
    <div className="w-full max-w-md">
      {saved ? (
        <p role="status" className="rounded-lg border border-amber-200/20 bg-amber-100/10 px-4 py-3 text-sm text-amber-100">
          Saved on this device. Nothing was sent anywhere — we will ask again at launch.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            try {
              window.localStorage.setItem(KEY, email.trim());
            } catch {
              return;
            }
            setSaved(true);
          }}
        >
          <label htmlFor="notify-email" className="sr-only">
            Email address
          </label>
          <input
            id="notify-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 flex-1 rounded-lg border border-white/15 bg-white/5 px-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-200/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!valid}
            className="h-12 rounded-lg bg-amber-200 px-6 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Notify me
          </button>
        </form>
      )}
      {!saved ? (
        <p className="mt-2 text-xs text-zinc-500">
          One email at launch, nothing else. Stored in this browser only.
        </p>
      ) : null}
    </div>
  );
}

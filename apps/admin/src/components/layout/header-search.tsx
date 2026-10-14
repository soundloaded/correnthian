'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserRound } from 'lucide-react';
import { NAV } from './nav-links';
import { searchAccounts, type AccountHit } from '@/app/(dashboard)/actions';

/**
 * Header palette: pages plus live account lookup.
 *
 * Pages filter locally — they are sixteen fixed destinations, and an index
 * over a constant needs no backend. Accounts go through `searchAccounts`,
 * which reads with the operator's session; short queries return nothing
 * rather than the directory. Nothing here is mock data: no-result states
 * say so, and a failed lookup says that instead of an empty list.
 */
export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AccountHit[]>([]);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [looking, setLooking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open ]);

  const lookup = useCallback((q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      setLookupFailed(false);
      setLooking(false);
      return;
    }
    setLooking(true);
    timer.current = setTimeout(() => {
      void searchAccounts(q).then((r) => {
        setLooking(false);
        if (!r.ok) {
          setHits([]);
          setLookupFailed(true);
        } else {
          setHits(r.items);
          setLookupFailed(false);
        }
      });
    }, 250);
  }, []);

  const pages = NAV.flatMap((g) => g.items).filter((p) =>
    p.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-xs items-center gap-2 rounded-lg border bg-muted/50 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search pages and accounts…</span>
        <kbd className="ml-auto hidden rounded border bg-background px-1.5 font-mono text-[11px] sm:block">⌘K</kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="w-full max-w-lg overflow-hidden rounded-xl border bg-popover shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  lookup(e.target.value);
                }}
                placeholder="Pages and account email…"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              <p className="px-2 pt-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Pages
              </p>
              {pages.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">No page matches.</p>
              ) : (
                pages.map((p) => (
                  <button
                    key={p.href}
                    type="button"
                    onClick={() => go(p.href)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <p.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {p.title}
                  </button>
                ))
              )}
              <p className="px-2 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Accounts
              </p>
              {lookupFailed ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Account lookup failed. Try again.</p>
              ) : query.trim().length < 2 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Type two or more characters.</p>
              ) : looking ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Looking up…</p>
              ) : hits.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">No account matches.</p>
              ) : (
                hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => go(`/users/${h.id}`)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{h.email}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{h.role}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

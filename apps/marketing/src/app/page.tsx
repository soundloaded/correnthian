import type { Metadata } from 'next';
import { NotifyForm } from './notify-form';

export const metadata: Metadata = {
  title: 'Correnthian — Gold you own outright',
  description:
    'Self-custodial tokenized gold: holding, backing and exit you can verify, fees stated up front.',
};

const NAV = [
  { href: '#trust', label: 'Trust' },
  { href: '#how', label: 'How it works' },
  { href: '#fees', label: 'Fees' },
  { href: '#faq', label: 'FAQ' },
];

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-16 sm:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">{eyebrow}</p>
      <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-200 antialiased">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-base font-semibold tracking-tight text-zinc-50">Correnthian</span>
          <nav aria-label="Sections" className="flex items-center gap-5">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hidden text-sm text-zinc-400 hover:text-zinc-100 sm:inline">
                {n.label}
              </a>
            ))}
            <a
              href="#notify"
              className="rounded-lg bg-amber-200 px-4 py-2 text-sm font-semibold text-zinc-950"
            >
              Get notified
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-5xl px-6 pb-16 pt-20 sm:pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">
            For people who own gold — or want to
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-6xl">
            Gold you own outright.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            Correnthian is a self-custodial way to hold and buy tokenized gold: metal delivered
            to an address only you can move, from issuers whose backing you can check, with
            fees stated up front. No broker holding your position. No keys leaving your hands.
          </p>
          <div id="notify" className="mt-10 scroll-mt-24">
            <NotifyForm />
          </div>
        </section>

        <div className="border-y border-white/10 bg-zinc-900/40">
          <Section
            id="trust"
            eyebrow="The trust model"
            title="Three questions every gold holder should be able to answer"
          >
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  q: 'What am I holding?',
                  a: 'Named tokens from named issuers — registered in the open with their backing disclosed, never anonymous metal.',
                },
                {
                  q: 'Who backs it?',
                  a: 'Each issuer discloses its custodian, vault locations, and proof-of-reserve attestations, kept current and visible.',
                },
                {
                  q: 'Can I take it out?',
                  a: 'Your metal sits at your own address, and physical redemption is part of the design — exit is a feature, not a favor.',
                },
              ].map((c) => (
                <div key={c.q} className="rounded-xl border border-white/10 bg-zinc-950 p-6">
                  <h3 className="text-lg font-semibold text-zinc-50">{c.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{c.a}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section
          id="how"
          eyebrow="How it will work"
          title="Four steps, each verifiable by you"
        >
          <ol className="grid gap-4 md:grid-cols-2">
            {[
              {
                t: 'Buy with card or bank',
                d: 'At launch, through licensed conversion partners — never by handing custody to a broker.',
              },
              {
                t: 'Metal lands where only you can move it',
                d: 'Delivery goes to an address controlled by keys that never leave your device.',
              },
              {
                t: 'See exactly what backs it',
                d: 'Custodian, vaults, and current attestations travel with every holding.',
              },
              {
                t: 'Redeem the physical metal',
                d: 'A defined payout path from token back to bars, tracked state by state.',
              },
            ].map((s, i) => (
              <li key={s.t} className="flex gap-4 rounded-xl border border-white/10 bg-zinc-900/40 p-6">
                <span aria-hidden className="font-mono text-2xl font-semibold text-amber-200/80">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-zinc-50">{s.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-zinc-500">
            Correnthian is in preparation: issuers, conversion partners, and approvals are being
            put in place. Nothing on this page is for sale yet.
          </p>
        </Section>

        <div className="border-y border-white/10 bg-zinc-900/40">
          <Section id="fees" eyebrow="Fees" title="Stated before you pay, itemised after">
            <div className="max-w-2xl space-y-4 text-zinc-400">
              <p>
                Correnthian earns stated, itemised fees — one named line per charge, shown before
                anything is signed. There is no spread hidden inside a rate and no guess
                presented as a price.
              </p>
              <p>
                Where a fee cannot be determined, the quote says it is unknown instead of
                writing zero. A zero nobody computed is a claim; an explicit unknown is the truth.
              </p>
            </div>
          </Section>
        </div>

        <Section id="faq" eyebrow="Questions" title="Asked plainly, answered plainly">
          <dl className="max-w-3xl divide-y divide-white/10">
            {[
              {
                q: 'Is Correnthian a custodian?',
                a: 'No. It holds no user assets and no key material. Your metal sits at addresses only you can move; compromising a Correnthian account can never yield funds.',
              },
              {
                q: 'Does Correnthian issue the gold tokens?',
                a: 'No. Issuers issue; Correnthian registers their tokens alongside backing disclosure, and refuses to list what it cannot describe.',
              },
              {
                q: 'Do my keys ever leave my device?',
                a: 'Never. Signing happens locally on hardware and software you control; the platform only ever sees signed transactions.',
              },
              {
                q: 'What does Correnthian earn?',
                a: 'Stated, itemised fees disclosed before you commit. It takes no principal risk and earns nothing from mispricing.',
              },
              {
                q: 'When does it open?',
                a: 'No date is set. Issuers, conversion partners, and approvals come first; this page will say when each lands.',
              },
              {
                q: 'Which chains and tokens?',
                a: 'That list will be published with the launch — every entry with its issuer, backing, and redemption path attached.',
              },
            ].map((f) => (
              <div key={f.q} className="py-5">
                <dt className="font-semibold text-zinc-50">{f.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-zinc-400">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-zinc-300">Correnthian</span>
          <span>Self-custodial tokenized precious metals. Opening in stages — this page announces each one.</span>
        </div>
      </footer>
    </div>
  );
}

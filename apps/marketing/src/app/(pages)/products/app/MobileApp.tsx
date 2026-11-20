import { findProduct } from '../content'
import Link from 'next/link'

const product = findProduct('app')!

if (!product) {
  throw new Error('Missing product page: app')
}

const screens = [
  {
    title: 'Portfolio',
    body: 'The phone would open on what you hold, the same account as the portfolio.',
  },
  {
    title: 'Buy',
    body: 'Buy is its own screen. Before you commit, the fee lines are still Provider, Network, and Correnthian.',
  },
  {
    title: 'Swap',
    body: 'Swap is a different screen. It is for assets you already hold, not a purchase.',
  },
  {
    title: 'Activity',
    body: 'Activity is the signed-in account’s buys, swaps, and sends, with amounts taken from the asset registry.',
  },
] as const

const faqs = [
  ...product.faqs,
  {
    question: 'Does the app send the key to Correnthian?',
    answer: 'No. The key stays on the phone. The app does not send a key to Correnthian. The account remains one only you can move.',
  },
]

const related = [
  {
    href: '/waitlist',
    title: 'Waitlist',
    body: 'There is no store listing. The waitlist is how to ask for access.',
    link: 'Join the waitlist',
  },
  {
    href: '/products/portfolio',
    title: 'Portfolio',
    body: 'The account opens on what you hold, and on who backs it. The phone would start there.',
    link: 'See the portfolio',
  },
  {
    href: '/download',
    title: 'Download',
    body: 'That page is the same fact. The listings are not live, and the store buttons elsewhere on this site are not this app.',
    link: 'Read the download page',
  },
] as const

export default function MobileApp() {
  return (
    <>
      <section className="pt-34 pb-16 md:pt-42 md:pb-20 lg:pt-50">
        <div className="container px-6">
          <div className="max-w-3xl">
            <p className="text-default-600 mb-3 text-sm font-medium">Mobile app</p>
            <h1 className="text-default-900 text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">The stores are not live</h1>
            <p className="text-default-600 mt-5 text-base leading-relaxed md:text-xl">
              There is no Correnthian app in the App Store or on Google Play, and nothing on this page is a download. The phone would show the same account: portfolio, buy, swap, and activity. The key stays on the phone.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/waitlist" className="inline-flex items-center justify-center rounded-full bg-default-900 px-6 py-3 text-sm font-medium text-white transition-all hover:scale-95">
                Join the waitlist
              </Link>
              <Link href="/download" className="text-default-900 text-sm font-medium underline underline-offset-4">
                The download page
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24">
        <div className="container px-6">
          <h2 className="text-default-900 mb-8 max-w-2xl text-3xl font-medium tracking-tight md:text-4xl">What the phone would show</h2>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {screens.map((screen) => (
              <li key={screen.title} className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
                <h3 className="text-default-900 text-lg font-medium">{screen.title}</h3>
                <p className="text-default-600 mt-2 text-sm leading-relaxed md:text-base">{screen.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {product.columns && product.columnsTitle ? (
        <section className="py-16 md:py-24">
          <div className="container px-6">
            <h2 className="text-default-900 mb-8 max-w-2xl text-3xl font-medium tracking-tight md:text-4xl">{product.columnsTitle}</h2>
            <div className="grid gap-5 md:grid-cols-2">
              {product.columns.map((column) => (
                <article key={column.title} className="rounded-3xl border border-zinc-100 bg-white p-6 md:p-8">
                  <h3 className="text-default-900 text-xl font-medium">{column.title}</h3>
                  <ul className="mt-5 space-y-3">
                    {column.items.map((item) => (
                      <li key={item} className="text-default-600 flex gap-3 text-sm leading-relaxed md:text-base">
                        <span aria-hidden className="bg-default-900 mt-2 size-1.5 shrink-0 rounded-full" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            {product.note ? <p className="text-default-500 mt-8 max-w-2xl text-sm leading-relaxed">{product.note}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="py-6 md:pb-10 lg:py-25">
        <div className="container px-6">
          <div className="grid grid-cols-1 items-start gap-7.5 md:grid-cols-3 lg:grid-cols-12 lg:gap-25">
            <div className="col-span-1 space-y-10 lg:col-span-5 lg:space-y-20">
              <div className="space-y-4">
                <span className="border-default-200 text-default-800 mb-2.5 inline-block rounded-full border bg-white px-5 py-1.5 text-sm font-medium">Common Questions</span>
                <h2 className="text-default-950 text-2xl leading-normal font-medium tracking-normal md:text-4xl lg:text-5xl">Frequently asked questions</h2>
              </div>
              <div className="space-y-6 rounded-2xl bg-white p-5 shadow-xl shadow-zinc-200/50 md:p-7.5">
                <div className="bg-primary-1 flex size-12.5 items-center justify-center rounded-full text-white shadow-lg">
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 11a9 9 0 0 1 18 0" />
                    <path d="M21 16v-2a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z" />
                    <path d="M3 16v-2a2 2 0 0 1 2-2h1v6H5a2 2 0 0 1-2-2z" />
                    <path d="M21 16v1a4 4 0 0 1-4 4h-5" />
                  </svg>
                </div>
                <div className="space-y-6">
                  <h3 className="text-default-950 mb-3.5 text-xl font-medium md:text-2xl">Can&apos;t find your answer?</h3>
                  <Link href="/contact" className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-black px-8.5 text-nowrap text-white shadow-xl transition-all duration-300 hover:scale-95">
                    <span className="relative inline-flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-full">
                      <span className="flex h-14 items-center gap-3">
                        <span className="font-medium">Contact us</span>
                      </span>
                      <span className="absolute top-full flex h-14 items-center gap-3">
                        <span className="font-medium">Contact us</span>
                      </span>
                    </span>
                  </Link>
                </div>
              </div>
            </div>
            <div className="col-span-2 space-y-2.5 lg:col-span-7 lg:space-y-4">
              <style>{'.app-faq[open] .app-faq-plus{transform:rotate(45deg)}.app-faq[open]{box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1),0 2px 4px -2px rgb(0 0 0 / 0.1)}'}</style>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0 ? true : undefined} className="app-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <summary className="text-default-900 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="pr-3 text-base font-medium md:text-xl">{faq.question}</h3>
                    <span className="app-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
                      <svg viewBox="0 0 24 24" className="size-3 md:size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-3.5 pb-3.5 text-base leading-normal text-zinc-500 md:text-lg md:leading-relaxed lg:px-5 lg:pb-5">{faq.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container px-6">
          <div className="mb-10 grid grid-cols-4 text-center md:mb-12 md:grid-cols-8 lg:mb-14 lg:grid-cols-12">
            <div className="col-span-4 md:col-span-8 lg:col-start-3">
              <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">Continue from here</h2>
            </div>
          </div>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-12 lg:items-start">
            {related.map((item, index) => (
              <li key={item.href} className={`lg:col-span-4 ${index % 2 === 0 ? 'lg:pt-28' : ''}`}>
                <article className="h-full rounded-3xl bg-zinc-100 p-6 xl:px-10 xl:py-8">
                  <h3 className="text-default-900 mb-2 text-xl">{item.title}</h3>
                  <p className="text-default-600 text-base leading-relaxed">{item.body}</p>
                  <Link href={item.href} className="text-default-900 mt-8 inline-flex items-center gap-2 text-sm font-medium">
                    {item.link}
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

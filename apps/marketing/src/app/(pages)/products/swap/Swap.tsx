import goldBar from '@/assets/images/about/vault-gold-02.webp'
import goldStack from '@/assets/images/about/vault-gold-01.webp'
import Image from 'next/image'
import Link from 'next/link'

const steps = [
  {
    title: 'Ask for a quote',
    body: 'The quote prices a move from one asset to another. Nothing is sent.',
  },
  {
    title: 'Read the limit',
    body: 'If liquidity is thin, or no provider is contracted, the quote stays closed.',
  },
  {
    title: 'Sign on your device',
    body: 'The server assembles the approve and the swap. It has no key that could sign them.',
  },
] as const

const columns = [
  {
    title: 'What the server does',
    body: 'It prices the quote and assembles an unsigned transaction. It refuses a quote it cannot fill. A live fill waits until a liquidity provider is contracted.',
    items: ['Prices the quote', 'Assembles the unsigned transaction', 'Refuses a quote it cannot fill'],
  },
  {
    title: 'What your device does',
    body: 'The key stays on your device. An unsigned quote expires, and it is not an order Correnthian can complete for you. Nothing moves until you sign.',
    items: ['Holds the key', 'Signs the approve and the swap', 'Nothing moves until that signature exists'],
  },
] as const

const faqs = [
  {
    question: 'Is a swap a purchase?',
    answer: 'No. A swap spends assets you already hold. A card or bank purchase is a different screen, and that screen stays closed until a provider is contracted. Correnthian does not take a card, hold fiat, or issue the token.',
  },
  {
    question: 'Does a quote move funds?',
    answer: 'No. Asking for a quote does not move funds. The server prepares an unsigned quote. Your device signs the approve and the swap, and the server has no key that could sign them. Funds would move only after that signature. An unsigned quote expires. A live fill waits until a liquidity provider is contracted, and a quote that cannot be filled stays closed.',
  },
  {
    question: 'Where do fees show?',
    answer: 'On the quote, before you sign, as three named lines: Provider, Network, and Correnthian. No percentage is published, and this page does not show a rate or a live price.',
  },
] as const

const related = [
  {
    href: '/products/buy',
    title: 'Buy gold',
    body: 'A card or bank purchase is a different path from a swap. That screen stays closed until a provider is contracted.',
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    link: 'See the buy screen',
  },
  {
    href: '/products/portfolio',
    title: 'Portfolio',
    body: 'The account home reads what you already hold, and who backs it. A figure appears only when a price is known.',
    image: goldStack,
    alt: 'Stacked gold bars',
    link: 'See the portfolio',
  },
  {
    href: '/pricing',
    title: 'Pricing',
    body: 'Provider, Network, and Correnthian are the three fee lines. No rate is published.',
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    link: 'How fees are shown',
  },
] as const

export default function Swap() {
  return (
    <>
      <section className="pt-36 pb-16 md:pt-44 md:pb-20 lg:pt-52">
        <div className="container px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h1 className="text-default-900 text-4xl tracking-tight md:text-5xl lg:text-6xl">Move assets you already hold</h1>
              <div className="text-default-600 mt-6 space-y-4 text-base leading-relaxed md:text-lg">
                <p>A swap spends assets you already hold. It is the path into gold in the same account, and it is not a card purchase. The server prepares an unsigned quote. Your device signs it. Asking for a quote does not move funds.</p>
                <p>A live fill waits until a liquidity provider is contracted. If the quote cannot be filled, it stays closed. The fee lines are Provider, Network, and Correnthian, with no published rate. This page does not show a live price.</p>
              </div>
              <div className="mt-8">
                <Link href="/products/buy" className="inline-flex items-center justify-center rounded-full bg-default-900 px-6 py-3 text-sm font-medium text-white transition-all hover:scale-95">
                  Wanted a card purchase
                </Link>
              </div>
            </div>
            <div className="relative min-h-[320px] overflow-hidden rounded-3xl sm:min-h-[420px] lg:min-h-[560px]">
              <Image src={goldBar} alt="A single fine gold bar on dark cloth" fill priority className="object-cover" sizes="(min-width: 1024px) 46vw, 100vw" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zinc-100 py-16 md:py-20">
        <div className="container px-6">
          <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
            <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">A quote, then a signature</h2>
            <p className="text-default-600 mt-4 text-base leading-relaxed md:mt-6 md:text-lg">Nothing here takes a card. A live fill waits until a liquidity provider is contracted.</p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-3xl bg-white p-6 md:p-8">
                <p className="text-default-500 text-sm font-medium">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="text-default-900 mt-4 text-2xl tracking-tight">{step.title}</h3>
                <p className="text-default-600 mt-3 text-base leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container px-6">
          <div className="mb-10 max-w-3xl md:mb-14">
            <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">Who does what</h2>
            <p className="text-default-600 mt-4 text-base leading-relaxed md:mt-6 md:text-lg">The server prepares the quote. Your device is the only place that can sign it. When a fill is possible, the gold stays in the same account only you can move.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {columns.map((column) => (
              <article key={column.title} className="rounded-3xl border border-zinc-100 bg-white p-6 md:p-10">
                <h3 className="text-default-900 text-2xl tracking-tight md:text-3xl">{column.title}</h3>
                <p className="text-default-600 mt-4 text-base leading-relaxed">{column.body}</p>
                <ul className="mt-6 space-y-3">
                  {column.items.map((item) => (
                    <li key={item} className="text-default-900 border-t border-zinc-100 pt-3 text-base font-medium">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-6 md:pb-10 lg:py-25">
        <div className="container px-6">
          <div className="grid grid-cols-1 items-start gap-7.5 md:grid-cols-3 lg:grid-cols-12 lg:gap-25">
            <div className="col-span-1 space-y-10 lg:col-span-5 lg:space-y-20">
              <div className="space-y-4">
                <span className="border-default-200 text-default-800 mb-2.5 inline-block rounded-full border bg-white px-5 py-1.5 text-sm font-medium">Common Questions</span>
                <h2 className="text-default-900 text-2xl leading-normal font-medium tracking-normal md:text-4xl lg:text-5xl">Frequently asked questions</h2>
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
                  <h3 className="text-default-900 mb-3.5 text-xl font-medium md:text-2xl">Can&apos;t find your answer?</h3>
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
              <style>{'.swap-faq[open] .swap-faq-plus{transform:rotate(45deg)}'}</style>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0 ? true : undefined} className="swap-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <summary className="text-default-900 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="pr-3 text-base font-medium md:text-xl">{faq.question}</h3>
                    <span className="swap-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
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
                <article className="overflow-hidden rounded-3xl">
                  <Link href={item.href}>
                    <div className="relative h-48">
                      <Image src={item.image} alt={item.alt} fill className={item.image === goldStack ? 'object-cover object-bottom' : 'object-cover'} sizes="(min-width: 1024px) 33vw, 100vw" />
                    </div>
                  </Link>
                  <div className="h-full bg-zinc-100 p-6 xl:px-10 xl:py-8">
                    <h3 className="text-default-900 mb-2 text-xl">{item.title}</h3>
                    <p className="text-default-600 text-base leading-relaxed">{item.body}</p>
                    <Link href={item.href} className="text-default-900 mt-8 inline-flex items-center gap-2 text-sm font-medium">
                      {item.link}
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

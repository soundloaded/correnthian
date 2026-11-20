import goldBar from '@/assets/images/about/vault-gold-02.webp'
import silverBars from '@/assets/images/about/metal-silver-01.webp'
import { findProduct } from '../content'
import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'

const portfolio = findProduct('portfolio')!

if (portfolio == null) {
  throw new Error('Missing portfolio product content')
}

const counted = portfolio.columns[0]
const leftOut = portfolio.columns[1]

if (counted == null || leftOut == null) {
  throw new Error('Missing portfolio columns')
}

const fields = [
  {
    label: 'Chain',
    value: 'The network this token is recorded on.',
  },
  {
    label: 'Contract',
    value: 'The address that identifies the asset. The same ticker on another contract is a different line.',
  },
  {
    label: 'Issuer',
    value: 'Who issued the token. Correnthian did not, and it does not custody the holding.',
  },
  {
    label: 'Backing',
    value: 'Allocated only when specific metal is reserved. Otherwise pooled, or price only.',
  },
] as const

const faqs = [
  {
    question: 'What is on each line?',
    answer: 'Chain, contract, issuer, and backing. The line is a holding the account already controls. Correnthian reads it and does not custody it. A price tracker is price exposure, not metal.',
  },
  {
    question: 'Why might the total skip a holding?',
    answer: 'A holding with no price is left out of the total and counted. The screen does not guess a cent to fill the gap.',
  },
  {
    question: 'Is pooled metal mine to take out?',
    answer: 'No. Pooled backing is not metal reserved for you. A synthetic token is not gold or silver you can take out. Specific metal counts as allocated only when it is reserved for that token.',
  },
] as const

const related: readonly {
  href: string
  title: string
  body: string
  image: StaticImageData
  alt: string
  link: string
}[] = [
  {
    href: '/products/gold',
    title: 'Gold',
    body: 'A third-party token, shown as gold you hold only when specific metal is allocated.',
    image: goldBar,
    alt: 'A gold bar on dark cloth',
    link: 'See gold',
  },
  {
    href: '/products/silver',
    title: 'Silver',
    body: 'The same registry and the same backing test. No silver token is claimed here as registered, allocated, or insured.',
    image: silverBars,
    alt: 'Stacked silver bars',
    link: 'See silver',
  },
  {
    href: '/products/activity',
    title: 'Activity',
    body: 'Buys, swaps, and sends for the signed-in account. Amounts come from the asset registry, not a guessed precision.',
    image: goldBar,
    alt: 'A gold bar on dark cloth',
    link: 'See activity',
  },
]

export default function Portfolio() {
  return (
    <>
      <section className="pt-32 pb-12 md:pt-40 md:pb-16 lg:pt-50 lg:pb-20">
        <div className="container px-6">
          <div className="max-w-3xl">
            <p className="text-default-600 mb-3 text-sm font-medium">Portfolio</p>
            <h1 className="text-default-900 text-4xl tracking-tight md:text-6xl">What you hold</h1>
            <p className="text-default-600 mt-5 max-w-2xl text-base leading-relaxed md:text-lg">Correnthian shows holdings the account already controls, and does not custody them. Each line names the chain, the contract, the issuer, and whether specific metal is allocated.</p>
            <div className="mt-8">
              <Link href="/products/gold" className="inline-flex items-center justify-center rounded-full bg-default-900 px-6 py-3 text-sm font-medium text-white transition-all hover:scale-95">
                See gold
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="container px-6">
          <div className="mb-8 max-w-2xl md:mb-10">
            <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">On each line</h2>
            <p className="text-default-600 mt-4 text-base leading-relaxed md:text-lg">One holding, as four fields. The words name what the line is for. This specimen has no figure.</p>
          </div>
          <article className="overflow-hidden rounded-3xl border border-zinc-100">
            <div className="border-b border-zinc-100 px-6 py-4">
              <p className="text-default-900 text-sm font-medium">Holding</p>
            </div>
            <dl className="grid gap-px bg-zinc-100 md:grid-cols-2 lg:grid-cols-4">
              {fields.map((field) => (
                <div key={field.label} className="bg-white p-6">
                  <dt className="text-default-500 text-xs font-medium tracking-wide uppercase">{field.label}</dt>
                  <dd className="text-default-900 mt-3 text-base leading-relaxed">{field.value}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container px-6">
          <div className="mb-10 grid grid-cols-4 text-center md:mb-12 md:grid-cols-8 lg:mb-14 lg:grid-cols-12">
            <div className="col-span-4 md:col-span-8 lg:col-start-3">
              <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">{portfolio.columnsTitle ?? 'Portfolio Holdings'}</h2>
              <p className="text-default-600 mt-4 text-base leading-relaxed md:text-lg">A known price can be counted. An unpriced holding is excluded, and the screen counts how many were excluded.</p>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <article className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
              <h3 className="text-default-900 text-2xl tracking-tight">Counted in the total</h3>
              <ul className="mt-6 divide-y divide-zinc-100">
                {counted.items.map((item) => (
                  <li key={item} className="text-default-700 py-3 text-base leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
              <h3 className="text-default-900 text-2xl tracking-tight">Left out of the total</h3>
              <ul className="mt-6 divide-y divide-zinc-100">
                {leftOut.items.map((item) => (
                  <li key={item} className="text-default-700 py-3 text-base leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

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
              <style>{'.portfolio-faq[open] .portfolio-faq-plus{transform:rotate(45deg)}'}</style>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0 ? true : undefined} className="portfolio-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <summary className="text-default-900 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="pr-3 text-base font-medium md:text-xl">{faq.question}</h3>
                    <span className="portfolio-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
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
                      <Image src={item.image} alt={item.alt} fill className="object-cover" sizes="(min-width: 1024px) 33vw, 100vw" />
                    </div>
                  </Link>
                  <div className="h-full bg-zinc-100 p-6 xl:px-10 xl:py-8">
                    <h3 className="text-default-900 mb-2 text-xl">{item.title}</h3>
                    <p className="text-default-600 text-base leading-relaxed">{item.body}</p>
                    <Link href={item.href} className="text-default-900 mt-8 inline-flex items-center gap-2 text-sm font-medium">
                      {item.link}
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12h14" />
                        <path d="m13 6 6 6-6 6" />
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

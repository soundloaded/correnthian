import goldBar from '@/assets/images/about/vault-gold-02.webp'
import goldStack from '@/assets/images/about/vault-gold-01.webp'
import silverBars from '@/assets/images/about/metal-silver-01.webp'
import { findProduct } from '../content'
import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

const gold = findProduct('gold')!

if (!gold) {
  throw new Error('Gold product content is missing')
}

const parts = [
  {
    title: 'Chain',
    body: 'The network the token is on. The same ticker on another chain is not this asset.',
  },
  {
    title: 'Contract',
    body: 'The contract that identifies the token. A different contract is a different asset.',
  },
  {
    title: 'Issuer',
    body: 'Who issued the token. Someone else did. The vault, if one is named, belongs to that issuer. Correnthian does not insure it.',
  },
] as const

const columnMedia: readonly { image: StaticImageData; alt: string; className: string }[] = [
  {
    image: goldStack,
    alt: 'Stacked gold bars',
    className: 'object-cover object-bottom',
  },
  {
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    className: 'object-cover',
  },
]

const faqs: readonly { question: string; answer: ReactNode }[] = [
  {
    question: 'Does Correnthian mint this gold?',
    answer: 'No. Correnthian does not mint this gold and does not run a vault. It registers a token someone else issued.',
  },
  {
    question: 'When is it called gold I hold?',
    answer: 'Only when specific metal is allocated to that token. A pool with no bar reserved for you, or a token that only tracks a gold price, is not described that way.',
  },
  {
    question: 'Who would deliver a bar?',
    answer: (
      <>
        The issuer would, under the issuer’s rules. Correnthian does not ship a bar.{' '}
        <Link href="/products/redemption" className="text-default-900 font-medium underline-offset-4 hover:underline">
          Taking it out
        </Link>{' '}
        records a request. It is not a shipment from Correnthian.
      </>
    ),
  },
]

const related: readonly {
  href: string
  title: string
  body: string
  image: StaticImageData
  alt: string
  link: string
}[] = [
  {
    href: '/products/buy',
    title: 'Buy gold',
    body: 'A card or bank purchase of a third-party gold token, into an account only you can move. That purchase stays refused until a provider is contracted.',
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    link: 'Buy gold',
  },
  {
    href: '/products/silver',
    title: 'Silver',
    body: 'The same registry and the same test. Silver is shown as metal you hold only when specific metal is allocated.',
    image: silverBars,
    alt: 'Stacked fine silver bars',
    link: 'See silver',
  },
  {
    href: '/products/redemption',
    title: 'Taking it out',
    body: 'Physical delivery is the issuer’s rule. Correnthian records a request and does not ship the bar.',
    image: goldStack,
    alt: 'Stacked gold bars',
    link: 'See redemption',
  },
]

function ButtonLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="inline-flex items-center justify-center rounded-full bg-default-900 px-6 py-3 text-sm font-medium text-white transition-all hover:scale-95">
      {children}
    </Link>
  )
}

export default function GoldAsset() {
  return (
    <>
      <section className="relative isolate flex min-h-[78vh] items-center overflow-hidden">
        <Image src={goldBar} alt="A single fine gold bar on dark cloth" fill priority sizes="100vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 container px-6 py-24 md:py-32">
          <div className="max-w-2xl rounded-3xl bg-white p-8 md:p-10">
            <h1 className="text-default-900 text-4xl tracking-tight md:text-6xl">How a gold token is named</h1>
            <p className="text-default-600 mt-6 text-base leading-relaxed md:text-lg">Not a house coin. Correnthian does not mint a gold token and does not run a vault. It registers a token someone else issued, and shows that token as gold you hold only when specific metal is allocated.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/products/buy">Buy gold</ButtonLink>
              <ButtonLink href="/products/redemption">Taking it out</ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">Chain, contract, issuer</h2>
            <p className="text-default-600 mt-4 text-base leading-relaxed md:mt-6 md:text-lg">Those three name the token. The same ticker on another contract is a different asset.</p>
          </div>
          <ul className="mt-10 grid gap-6 md:mt-12 md:grid-cols-3">
            {parts.map((part) => (
              <li key={part.title} className="rounded-3xl bg-white p-6 md:p-8">
                <h3 className="text-default-900 text-2xl tracking-tight">{part.title}</h3>
                <p className="text-default-600 mt-3 text-sm leading-relaxed md:text-base">{part.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {gold.columns && gold.columnsTitle ? (
        <section className="pb-16 md:pb-20">
          <div className="container px-6">
            <div className="mx-auto mb-8 max-w-2xl text-center md:mb-10">
              <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">{gold.columnsTitle}</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {gold.columns.map((column, index) => {
                const media = columnMedia[index]
                if (!media) return null
                return (
                  <article key={column.title} className="relative overflow-hidden rounded-3xl">
                    <Image src={media.image} alt={media.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className={media.className} />
                    <div className="relative z-10 m-4 max-w-md rounded-3xl bg-white p-6 shadow-sm md:m-8 md:p-8">
                      <h3 className="text-default-900 text-2xl tracking-tight md:text-3xl">{column.title}</h3>
                      <ul className="mt-6 space-y-3">
                        {column.items.map((item) => (
                          <li key={item} className="text-default-600 flex gap-3 text-sm leading-relaxed md:text-base">
                            <span aria-hidden className="bg-default-900 mt-2 size-1.5 shrink-0 rounded-full" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="pb-6 md:pb-10">
        <div className="container px-6">
          <p className="text-default-600 mx-auto max-w-3xl text-center text-base leading-relaxed md:text-lg">PAXG and XAUT are examples of allocated tokens issued by someone else, not assets Correnthian lists.</p>
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
              <style>{'.gold-asset-faq[open] .gold-asset-faq-plus{transform:rotate(45deg)}'}</style>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0 ? true : undefined} className="gold-asset-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <summary className="text-default-900 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="pr-3 text-base font-medium md:text-xl">{faq.question}</h3>
                    <span className="gold-asset-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
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
              <li key={item.href} className={`lg:col-span-4 ${index % 2 === 1 ? 'lg:pt-28' : ''}`}>
                <article className="overflow-hidden rounded-3xl">
                  <Link href={item.href}>
                    <div className="relative h-48">
                      <Image src={item.image} alt={item.alt} fill className={`object-cover ${item.image === goldStack ? 'object-bottom' : ''}`} sizes="(min-width: 1024px) 33vw, 100vw" />
                    </div>
                  </Link>
                  <div className="h-full bg-zinc-100 p-6 xl:px-10 xl:py-8">
                    <h3 className="text-default-900 mb-2 text-xl">{item.title}</h3>
                    <p className="text-default-600 text-base leading-relaxed">{item.body}</p>
                    <Link href={item.href} className="text-default-900 mt-8 inline-flex items-center gap-2 text-sm font-medium">
                      {item.link}
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
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

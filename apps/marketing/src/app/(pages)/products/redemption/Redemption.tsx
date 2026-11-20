import goldBar from '@/assets/images/about/vault-gold-02.webp'
import silverBars from '@/assets/images/about/metal-silver-01.webp'
import { findProduct } from '../content'
import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'

const redemption = findProduct('redemption')

if (!redemption) {
  throw new Error('Missing redemption copy')
}

const faqs = [
  {
    question: 'Does Correnthian ship the bar?',
    answer: 'No. Correnthian records the request. It does not hold, mint, burn, or ship the bar. The issuer delivers the metal, if their terms allow it.',
  },
  {
    question: 'Who sets the minimum?',
    answer: 'The issuer sets the minimum, any identity check, and whether a bar can go anywhere. A small balance is not a promise of a bar.',
  },
  {
    question: 'Can I pick another country?',
    answer: 'No. Jurisdiction is read from the account. The form cannot switch country.',
  },
]

const related: readonly {
  slug: 'gold' | 'silver' | 'portfolio'
  image: StaticImageData
  alt: string
  link: string
}[] = [
  {
    slug: 'gold',
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    link: 'See gold',
  },
  {
    slug: 'silver',
    image: silverBars,
    alt: 'Stacked fine silver bars',
    link: 'See silver',
  },
  {
    slug: 'portfolio',
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    link: 'See the portfolio',
  },
]

export default function Redemption() {
  return (
    <>
      <section className="pt-34 pb-16 md:pt-42 md:pb-20 lg:pt-50">
        <div className="container px-6">
          <div className="grid grid-cols-4 items-center gap-y-10 md:grid-cols-8 lg:grid-cols-12 lg:gap-x-10">
            <div className="col-span-4 md:col-span-8 lg:col-span-6">
              <p className="text-default-600 mb-3 text-sm font-medium">Take it out</p>
              <h1 className="text-default-900 text-4xl tracking-tight md:text-6xl lg:text-7xl">A request, not a shipment</h1>
              <p className="text-default-900 mt-6 text-base leading-relaxed md:text-lg">This page is not an offer to deliver bars.</p>
              <p className="text-default-600 mt-4 text-base leading-relaxed md:text-lg">Redemption records a request. It names the token and the amount. It does not create metal, and Correnthian does not ship it.</p>
              <div className="mt-8">
                <Link href="/products/gold" className="inline-flex items-center justify-center rounded-full bg-default-900 px-6 py-3 text-sm font-medium text-white transition-all hover:scale-95">
                  See gold
                </Link>
              </div>
            </div>
            <div className="col-span-4 md:col-span-6 md:col-start-2 lg:col-span-5 lg:col-start-8">
              <Image src={goldBar} alt="A single fine gold bar on dark cloth" priority className="aspect-[4/3] w-full rounded-3xl object-cover" />
            </div>
          </div>
        </div>
      </section>

      {redemption.steps ? (
        <section className="bg-white py-16 md:py-20">
          <div className="container px-6">
            <div className="mb-8 grid grid-cols-4 md:mb-10 md:grid-cols-8 lg:grid-cols-12">
              <div className="col-span-4 text-center md:col-span-8 lg:col-span-8 lg:col-start-3">
                <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">How the request is recorded</h2>
              </div>
            </div>
            <ol className="grid gap-5 md:grid-cols-3">
              {redemption.steps.map((step, index) => (
                <li key={step.title} className="rounded-3xl border border-zinc-100 bg-zinc-50 p-6 md:p-8">
                  <p className="text-default-400 text-sm font-medium">{String(index + 1).padStart(2, '0')}</p>
                  <h3 className="text-default-900 mt-3 text-xl">{step.title}</h3>
                  <p className="text-default-600 mt-3 text-base leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {redemption.columns && redemption.columnsTitle ? (
        <section className="py-16 md:py-20">
          <div className="container px-6">
            <div className="mb-8 grid grid-cols-4 md:mb-10 md:grid-cols-8 lg:grid-cols-12">
              <div className="col-span-4 text-center md:col-span-8 lg:col-span-8 lg:col-start-3">
                <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">{redemption.columnsTitle}</h2>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {redemption.columns.map((column) => (
                <article key={column.title} className="rounded-3xl border border-zinc-100 bg-white p-6 md:p-8">
                  <h3 className="text-default-900 text-xl">{column.title}</h3>
                  <ul className="mt-5 space-y-3">
                    {column.items.map((item) => (
                      <li key={item} className="text-default-600 flex gap-3 text-base leading-relaxed">
                        <span aria-hidden className="bg-default-900 mt-2 size-1.5 shrink-0 rounded-full" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="pb-16 md:pb-20">
        <div className="container px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5">
            <p className="text-default-900 text-base leading-relaxed">Not an offer. Issuer minimums apply.</p>
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
                  <Link href="/contact" className="inline-flex items-center justify-center rounded-full bg-default-900 px-6 py-3 text-sm font-medium text-white transition-all hover:scale-95">
                    Contact us
                  </Link>
                </div>
              </div>
            </div>
            <div className="col-span-2 space-y-2.5 lg:col-span-7 lg:space-y-4">
              <style>{'.redemption-faq[open] .redemption-faq-plus{transform:rotate(45deg)}'}</style>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0 ? true : undefined} className="redemption-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <summary className="text-default-900 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="pr-3 text-base font-medium md:text-xl">{faq.question}</h3>
                    <span className="redemption-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
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
            {related.map((item, index) => {
              const page = findProduct(item.slug)
              if (!page) return null
              return (
                <li key={item.slug} className={`lg:col-span-4 ${index % 2 === 0 ? 'lg:pt-28' : ''}`}>
                  <article className="overflow-hidden rounded-3xl">
                    <Link href={`/products/${page.slug}`}>
                      <div className="relative h-48">
                        <Image src={item.image} alt={item.alt} fill className="object-cover" sizes="(min-width: 1024px) 33vw, 100vw" />
                      </div>
                    </Link>
                    <div className="h-full bg-zinc-100 p-6 xl:px-10 xl:py-8">
                      <h3 className="text-default-900 mb-2 text-xl">{page.label}</h3>
                      <p className="text-default-600 text-base leading-relaxed">{page.detail}</p>
                      <Link href={`/products/${page.slug}`} className="text-default-900 mt-8 inline-flex items-center gap-2 text-sm font-medium">
                        {item.link}
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </>
  )
}

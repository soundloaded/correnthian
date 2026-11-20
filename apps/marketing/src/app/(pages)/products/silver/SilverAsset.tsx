import silverBars from '@/assets/images/about/metal-silver-01.webp'
import silverCoins from '@/assets/images/about/metal-silver-02.webp'
import goldBar from '@/assets/images/about/vault-gold-02.webp'
import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'

const steps = [
  {
    title: 'Name the issuer',
    body: 'Chain, contract, and issuer say which token this is. Correnthian does not issue silver and does not run a vault. The test is the same one used for gold.',
  },
  {
    title: 'Allocated means reserved metal',
    body: 'Specific metal for that token, with a custodian and an attestation when those are on the record. Unallocated is not a bar reserved for you.',
  },
  {
    title: 'Otherwise it stays unlabeled',
    body: 'A synthetic token that tracks silver is price exposure, not metal you can take out. A pool with no reserved metal, or a token with no issuer on the record, stays unlabeled as silver you hold.',
  },
] as const

const columns = [
  {
    title: 'Can be shown as silver',
    items: ['Specific metal allocated to the token', 'A named issuer', 'A vault and an attestation on the record'],
  },
  {
    title: 'Stays unlabeled as that',
    items: ['A price tracker', 'A pool with no reserved metal', 'A token with no issuer record'],
  },
] as const

const faqs = [
  {
    question: 'Is this Correnthian silver?',
    answer: 'No. Correnthian does not issue silver and does not run a vault. Nothing on this page is a listed allocated silver coin.',
  },
  {
    question: 'When can you call it silver I hold?',
    answer: 'When the record names an issuer, a vault, and an attestation, and specific metal is reserved for that token. Unallocated is not a bar reserved for you. A synthetic tracker is price exposure. Until then, it stays unlabeled.',
  },
  {
    question: 'Does it pay a yield?',
    answer: 'No.',
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
    href: '/products/buy-silver',
    title: 'Buy silver',
    body: 'The card or bank path for a third-party token, on its own page. That purchase stays closed until a provider is contracted.',
    image: silverBars,
    alt: 'Stacked fine silver bars',
    link: 'See buy silver',
  },
  {
    href: '/products/gold',
    title: 'Gold',
    body: 'The same backing test, for a third-party gold token. Shown as metal only when specific gold is allocated.',
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    link: 'See gold',
  },
  {
    href: '/products/redemption',
    title: 'Redemption',
    body: 'A request records the asset and the amount. The issuer delivers the metal. Correnthian does not ship it.',
    image: silverCoins,
    alt: 'Silver coins',
    link: 'See redemption',
  },
]

function StepIcon({ index }: { index: number }) {
  const className = 'size-5'
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 19a7 7 0 0 1 14 0" />
      </svg>
    )
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7h16v3.5H4z" />
        <path d="M4 13.5h16V17H4z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 13.5 13.5 20a2 2 0 0 1-2.8 0L4 13.3V4h9.3L20 10.7a2 2 0 0 1 0 2.8z" />
      <path d="M8 8h.01" />
      <path d="M4 20 20 4" />
    </svg>
  )
}

function ButtonLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="inline-flex items-center justify-center rounded-full bg-default-900 text-white px-6 py-3 text-sm font-medium transition-all hover:scale-95">
      {children}
    </Link>
  )
}

export default function SilverAsset() {
  return (
    <>
      <section className="pt-34 pb-16 md:pt-42 md:pb-20 lg:pt-50">
        <div className="container px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-default-500 mb-3 text-sm font-medium">Assets</p>
              <h1 className="text-default-900 text-4xl tracking-tight md:text-5xl lg:text-6xl">Silver, only when the record says so</h1>
              <p className="text-default-600 mt-5 max-w-xl text-base leading-relaxed md:text-lg">
                Nothing on this page is a listed allocated silver coin. Silver follows the same test as gold: a third-party token, named by chain, contract, and issuer, and shown as metal only when specific silver is allocated. Correnthian does not issue silver and does not run a vault.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/products/buy-silver">Buy silver</ButtonLink>
                <ButtonLink href="/products/gold">See gold</ButtonLink>
              </div>
            </div>
            <div className="relative mx-auto h-[600px] w-full max-w-[600px] overflow-hidden rounded-3xl">
              <Image src={silverBars} alt="Stacked fine silver bars" fill priority className="object-cover object-center" sizes="(min-width: 1024px) 600px, 100vw" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24">
        <div className="container px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">The same test as gold</h2>
            <p className="text-default-600 mt-4 text-base leading-relaxed md:text-lg">A silver token is not presented as allocated metal until the issuer, the vault, and an attestation are on the record.</p>
            <ol className="mt-12">
              {steps.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[3rem_1fr] gap-x-6">
                  <div className="flex h-full flex-col items-center">
                    <span className="bg-default-900 flex size-12 shrink-0 items-center justify-center rounded-full text-white">
                      <StepIcon index={index} />
                    </span>
                    {index < steps.length - 1 ? <span className="my-2 w-px flex-1 bg-zinc-300" /> : null}
                  </div>
                  <div className={index < steps.length - 1 ? 'pb-12' : ''}>
                    <p className="text-default-400 text-sm font-medium">{String(index + 1).padStart(2, '0')}</p>
                    <h3 className="text-default-900 mt-1 text-2xl">{step.title}</h3>
                    <p className="text-default-600 mt-3 text-base leading-relaxed md:text-lg">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">When a token is silver you hold</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {columns.map((column, index) => (
                <article key={column.title} className={index === 0 ? 'rounded-3xl bg-white p-8 md:p-10' : 'rounded-3xl border border-zinc-200 p-8 md:p-10'}>
                  <h3 className="text-default-900 text-2xl">{column.title}</h3>
                  <ul className="mt-6 space-y-4">
                    {column.items.map((item) => (
                      <li key={item} className="text-default-600 flex gap-3 text-base leading-relaxed">
                        <span aria-hidden className={index === 0 ? 'bg-default-900 mt-2 size-1.5 shrink-0 rounded-full' : 'mt-2 size-1.5 shrink-0 rounded-full border border-zinc-400'} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
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
              <style>{'.silver-asset-faq[open] .silver-asset-faq-plus{transform:rotate(45deg)}'}</style>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0 ? true : undefined} className="silver-asset-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <summary className="text-default-900 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="pr-3 text-base font-medium md:text-xl">{faq.question}</h3>
                    <span className="silver-asset-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
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
